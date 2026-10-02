'use client';

import { CloudArrowUpIn, Xmark } from '@gravity-ui/icons';
import { Button, Chip, ProgressBar } from '@heroui/react';
import { useRouter } from 'next/navigation';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  ACCEPT,
  ALLOWED_LIST,
  checkFile,
  MAX_FILES_PER_MEETING,
  type MeetingFileKind,
} from '@/lib/file-types';
import type { ListedMeetingFile } from '@/lib/meetings';
import { completeUpload, createUpload, deleteFile } from './actions';
import { FileRow } from './file-row';
import { DeleteFileDialog, ListedFile } from './listed-file';

type Phase =
  // Registering the file with the API.
  | 'preparing'
  // Bytes on their way to storage.
  | 'uploading'
  // The API is checking what arrived.
  | 'finishing'
  // Queued; shown until the refreshed server list includes it.
  | 'done'
  | 'cancelled'
  | 'failed'
  // Refused before anything was sent.
  | 'rejected';

type Upload = {
  key: string;
  name: string;
  size: number;
  kind?: MeetingFileKind;
  phase: Phase;
  // 0–100 while uploading.
  progress: number;
  error?: string;
  fileId?: string;
};

const ACTIVE: ReadonlySet<Phase> = new Set(['preparing', 'uploading', 'finishing']);

// Listed URLs expire 15 minutes after the fetch; re-fetching more often keeps
// Download working on a page left open.
const URL_REFRESH_MS = 10 * 60 * 1000;

// The meeting's files: a drop zone, the uploads in progress and the confirmed
// files (play, download, delete). Uploads go from the browser straight to
// storage through a presigned URL; the Server Actions only register, confirm
// and delete them.
export function FilesPanel({
  meetingId,
  files: serverFiles,
}: {
  meetingId: string;
  files: ListedMeetingFile[];
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [isDragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Per upload: the request to abort, and whether the user cancelled it.
  const controls = useRef(new Map<string, { xhr?: XMLHttpRequest; cancelled: boolean }>());
  const listRef = useRef<HTMLUListElement>(null);
  // The file whose player or transcript is open.
  const [openId, setOpenId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ListedMeetingFile | null>(null);
  // Hidden at once, before the refreshed list arrives without them.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(new Set());

  const files = serverFiles.filter((file) => !deletedIds.has(file.id));
  // A finished upload stands in for its file until the server's list has it.
  // Hidden as soon as the server lists it (or it is deleted), and dropped
  // from state below, so a later delete cannot bring the stand-in back.
  const serverIds = new Set(serverFiles.map((file) => file.id));
  const visibleUploads = uploads.filter(
    (upload) =>
      !(
        upload.phase === 'done' &&
        upload.fileId &&
        (serverIds.has(upload.fileId) || deletedIds.has(upload.fileId))
      ),
  );
  // Adjusting state while rendering, as React recommends over an effect.
  const listedKey = serverFiles.map((file) => file.id).join(',');
  const [prunedFor, setPrunedFor] = useState(listedKey);
  if (prunedFor !== listedKey) {
    setPrunedFor(listedKey);
    setUploads((list) => {
      const kept = list.filter((u) => !(u.phase === 'done' && u.fileId && serverIds.has(u.fileId)));
      return kept.length === list.length ? list : kept;
    });
  }
  const pending = visibleUploads.filter((u) => ACTIVE.has(u.phase) || u.phase === 'done').length;
  const freeSlots = Math.max(0, MAX_FILES_PER_MEETING - files.length - pending);
  const isUploading = uploads.some((upload) => ACTIVE.has(upload.phase));

  const update = useCallback((key: string, patch: Partial<Upload>) => {
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }, []);

  const fail = useCallback(
    (key: string, name: string, error: string) => {
      update(key, { phase: 'failed', error });
      setAnnouncement(`${name} was not added. ${error}`);
    },
    [update],
  );

  const start = useCallback(
    async (key: string, file: File) => {
      const control = { cancelled: false } as { xhr?: XMLHttpRequest; cancelled: boolean };
      controls.current.set(key, control);

      const created = await createUpload(meetingId, {
        name: file.name,
        mimeType: file.type,
        size: file.size,
      });
      if (control.cancelled) {
        // Cancelled while the file was being registered: free its slot.
        if (created.ok) void deleteFile(meetingId, created.file.id);
        return;
      }
      if (!created.ok) {
        fail(key, file.name, created.error);
        return;
      }
      update(key, { phase: 'uploading', fileId: created.file.id });

      const status = await new Promise<'ok' | 'error' | 'aborted'>((resolve) => {
        const xhr = new XMLHttpRequest();
        control.xhr = xhr;
        xhr.open('PUT', created.uploadUrl);
        for (const [name, value] of Object.entries(created.uploadHeaders)) {
          xhr.setRequestHeader(name, value);
        }
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            update(key, { progress: Math.round((event.loaded / event.total) * 100) });
          }
        };
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? 'ok' : 'error');
        xhr.onerror = () => resolve('error');
        xhr.onabort = () => resolve('aborted');
        xhr.send(file);
      });
      if (status === 'aborted' || control.cancelled) return;
      if (status === 'error') {
        fail(key, file.name, 'The upload was interrupted. Remove it and add the file again.');
        return;
      }

      update(key, { phase: 'finishing', progress: 100 });
      const completed = await completeUpload(meetingId, created.file.id);
      if (control.cancelled) return;
      if (!completed.ok) {
        fail(key, file.name, completed.error);
        return;
      }
      update(key, { phase: 'done' });
      setAnnouncement(`${file.name} uploaded.`);
      controls.current.delete(key);
      startRefresh(() => router.refresh());
    },
    [fail, meetingId, router, update],
  );

  const addFiles = (list: FileList | File[]) => {
    let slots = freeSlots;
    const added: Upload[] = [];
    const toStart: [string, File][] = [];
    for (const file of Array.from(list)) {
      const key = crypto.randomUUID();
      const check = checkFile(file);
      if (!check.ok) {
        added.push({
          key,
          name: file.name,
          size: file.size,
          phase: 'rejected',
          progress: 0,
          error: check.error,
        });
      } else if (slots === 0) {
        added.push({
          key,
          name: file.name,
          size: file.size,
          kind: check.kind,
          phase: 'rejected',
          progress: 0,
          error: `A meeting can have up to ${MAX_FILES_PER_MEETING} files.`,
        });
      } else {
        slots -= 1;
        added.push({
          key,
          name: file.name,
          size: file.size,
          kind: check.kind,
          phase: 'preparing',
          progress: 0,
        });
        toStart.push([key, file]);
      }
    }
    if (added.length === 0) return;
    setUploads((current) => [...current, ...added]);
    const rejected = added.filter((u) => u.phase === 'rejected').length;
    setAnnouncement(
      [
        toStart.length > 0
          ? `Uploading ${toStart.length} ${toStart.length === 1 ? 'file' : 'files'}.`
          : '',
        rejected > 0 ? `${rejected} ${rejected === 1 ? 'file was' : 'files were'} not added.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    for (const [key, file] of toStart) void start(key, file);
  };

  const cancel = (key: string) => {
    const control = controls.current.get(key);
    if (control) {
      control.cancelled = true;
      control.xhr?.abort();
      controls.current.delete(key);
    }
    const upload = uploads.find((u) => u.key === key);
    update(key, { phase: 'cancelled' });
    if (upload) setAnnouncement(`Upload of ${upload.name} cancelled.`);
    // The API keeps the pending file, which holds a slot, until it is deleted.
    if (upload?.fileId) void deleteFile(meetingId, upload.fileId);
  };

  // Returns an error message for the dialog, or null when the file is gone.
  const confirmDelete = async (file: ListedMeetingFile): Promise<string | null> => {
    const result = await deleteFile(meetingId, file.id);
    if (!result.ok) return result.error;
    setDeletedIds((ids) => new Set(ids).add(file.id));
    if (openId === file.id) setOpenId(null);
    setToDelete(null);
    setAnnouncement(`${file.name} deleted.`);
    // The Delete button that opened the dialog is gone. The dialog hands focus
    // back to it when its exit animation ends, which would drop focus to the
    // page; once the dialog has left, put focus on the list instead.
    focusWhenDialogCloses(() => listRef.current?.focus());
    startRefresh(() => router.refresh());
    return null;
  };

  const dismiss = (key: string) => setUploads((list) => list.filter((u) => u.key !== key));

  useEffect(() => {
    if (serverFiles.length === 0) return;
    const timer = window.setInterval(() => startRefresh(() => router.refresh()), URL_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router, serverFiles.length]);

  // Leaving the page would abort the uploads, so ask first.
  useEffect(() => {
    if (!isUploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isUploading]);

  // A file dropped next to the zone would make the browser open it and leave
  // the page; only the zone takes drops.
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');
  const onDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = freeSlots > 0 ? 'copy' : 'none';
  };
  const onDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };
  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    // Lets the same file be chosen again after a removal.
    event.target.value = '';
  };

  const isFull = freeSlots === 0;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          isDragging ? 'border-accent bg-accent-soft' : 'border-separator'
        }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
          <CloudArrowUpIn aria-hidden className="size-5" />
        </span>
        {isFull ? (
          <p className="text-sm text-muted">
            This meeting has {MAX_FILES_PER_MEETING} files, the most it can hold.
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">
              {isDragging ? (
                'Drop to upload'
              ) : (
                // Phones and tablets have nothing to drag from.
                <>
                  <span className="pointer-coarse:hidden">Drag recordings or transcripts here</span>
                  <span className="hidden pointer-coarse:inline">
                    Add recordings or transcripts
                  </span>
                </>
              )}
            </p>
            <Button
              className="h-11"
              size="sm"
              variant="secondary"
              onPress={() => inputRef.current?.click()}
            >
              Choose files
            </Button>
          </>
        )}
        <p className="text-xs text-muted">
          {ALLOWED_LIST}. Up to 1 GB each, {MAX_FILES_PER_MEETING} files per meeting.
        </p>
        <input
          ref={inputRef}
          multiple
          accept={ACCEPT}
          aria-hidden
          className="hidden"
          tabIndex={-1}
          type="file"
          onChange={onChoose}
        />
      </div>

      {/* Upload progress and results, read out without moving focus. */}
      <p aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>

      {visibleUploads.length > 0 || files.length > 0 ? (
        <ul
          ref={listRef}
          aria-label="Files"
          className="flex flex-col divide-y divide-separator rounded-lg outline-none focus-visible:focus-ring"
          tabIndex={-1}
        >
          {visibleUploads.map((upload) => (
            <UploadRow
              key={upload.key}
              upload={upload}
              onCancel={() => cancel(upload.key)}
              onDismiss={() => dismiss(upload.key)}
            />
          ))}
          {files.map((file) => (
            <ListedFile
              key={file.id}
              file={file}
              isOpen={openId === file.id}
              onDelete={() => setToDelete(file)}
              onToggle={() => setOpenId((id) => (id === file.id ? null : file.id))}
            />
          ))}
        </ul>
      ) : null}

      <DeleteFileDialog
        file={toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function UploadRow({
  upload,
  onCancel,
  onDismiss,
}: {
  upload: Upload;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const { name, size, kind, phase, progress, error } = upload;

  if (phase === 'done') {
    return (
      <FileRow
        kind={kind}
        name={name}
        size={size}
        status={
          <Chip size="sm" variant="soft">
            Queued
          </Chip>
        }
      />
    );
  }

  if (phase === 'failed' || phase === 'rejected' || phase === 'cancelled') {
    return (
      <FileRow
        kind={kind}
        name={name}
        size={size}
        note={
          phase === 'cancelled' ? (
            <span className="text-muted">Upload cancelled.</span>
          ) : (
            <span className="text-danger">{error}</span>
          )
        }
      >
        <Button
          isIconOnly
          aria-label={`Remove ${name} from the list`}
          className="size-11 shrink-0"
          size="sm"
          variant="ghost"
          onPress={onDismiss}
        >
          <Xmark aria-hidden />
        </Button>
      </FileRow>
    );
  }

  const label =
    phase === 'preparing'
      ? 'Preparing…'
      : phase === 'finishing'
        ? 'Checking the upload…'
        : `${progress}%`;
  return (
    <FileRow
      kind={kind}
      name={name}
      size={size}
      note={
        <ProgressBar
          aria-label={`Uploading ${name}`}
          className="mt-1 w-full"
          isIndeterminate={phase !== 'uploading'}
          size="sm"
          value={progress}
          valueLabel={label}
        >
          <div className="flex justify-between text-xs text-muted">
            <span>{phase === 'uploading' ? 'Uploading' : label}</span>
            {phase === 'uploading' ? <ProgressBar.Output /> : null}
          </div>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      }
    >
      {phase === 'finishing' ? null : (
        <Button className="h-11 shrink-0" size="sm" variant="ghost" onPress={onCancel}>
          Cancel
        </Button>
      )}
    </FileRow>
  );
}

// Runs `focus` once no alert dialog is in the DOM, checking each frame for up
// to a second.
function focusWhenDialogCloses(focus: () => void) {
  const started = performance.now();
  const check = () => {
    if (!document.querySelector('[role=alertdialog]')) {
      focus();
    } else if (performance.now() - started < 1000) {
      requestAnimationFrame(check);
    }
  };
  requestAnimationFrame(check);
}
