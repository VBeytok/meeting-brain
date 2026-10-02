'use client';

import { ArrowDownToLine, ArrowRotateRight, TrashBin } from '@gravity-ui/icons';
import { AlertDialog, Alert, Button, Chip, Spinner } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { useRouter } from 'next/navigation';
import { type RefObject, useRef, useState, useTransition } from 'react';
import type { ListedMeetingFile } from '@/lib/meetings';
import { retryFile } from './actions';
import { FileRow } from './file-row';
import { TranscriptView } from './transcript-view';

// A confirmed file: Play (or Open, for a ready transcript file), Download
// and Delete, with its processing status. A failed file shows why and a Retry.
export function ListedFile({
  meetingId,
  file,
  isOpen,
  onToggle,
  onDelete,
}: {
  meetingId: string;
  file: ListedMeetingFile;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const panelId = `file-${file.id}-panel`;
  const isRecording = file.kind === 'RECORDING';
  // A transcript opens once it is parsed; a recording plays in any state.
  const canOpen = isRecording || (file.status === 'READY' && file.transcript !== null);
  return (
    <FileRow
      below={
        isOpen && canOpen ? (
          <div className="mt-3" id={panelId}>
            {isRecording ? (
              <RecordingView file={file} />
            ) : (
              <TranscriptView name={file.name} transcript={file.transcript!} />
            )}
          </div>
        ) : null
      }
      kind={file.kind}
      mimeType={file.mimeType}
      name={file.name}
      note={file.status === 'FAILED' ? <FailedNote file={file} meetingId={meetingId} /> : undefined}
      size={file.size}
      status={<StatusChip file={file} />}
    >
      <div className="flex shrink-0 items-center">
        {canOpen ? (
          <Button
            aria-controls={isOpen ? panelId : undefined}
            aria-expanded={isOpen}
            className="h-11"
            size="sm"
            variant="ghost"
            onPress={onToggle}
          >
            {isRecording ? (isOpen ? 'Hide' : 'Play') : isOpen ? 'Close' : 'Open'}
          </Button>
        ) : null}
        {/* A link, so the browser saves it; storage sends it as an attachment. */}
        <a
          aria-label={`Download ${file.name}`}
          className={buttonVariants({
            isIconOnly: true,
            size: 'sm',
            variant: 'ghost',
            className: 'size-11',
          })}
          href={file.downloadUrl}
          title="Download"
        >
          <ArrowDownToLine aria-hidden />
        </a>
        <Button
          isIconOnly
          aria-label={`Delete ${file.name}`}
          className="size-11"
          size="sm"
          variant="ghost"
          onPress={onDelete}
        >
          <TrashBin aria-hidden />
        </Button>
      </div>
    </FileRow>
  );
}

function StatusChip({ file }: { file: ListedMeetingFile }) {
  if (file.status === 'READY') {
    return (
      <Chip color="success" size="sm" variant="soft">
        Ready
      </Chip>
    );
  }
  if (file.status === 'FAILED') {
    return (
      <Chip color="danger" size="sm" variant="soft">
        Failed
      </Chip>
    );
  }
  // QUEUED: a transcript file is about to be parsed, a recording to be sent
  // for transcription. TRANSCRIBING: the provider is working on it.
  const label =
    file.status === 'TRANSCRIBING'
      ? 'Transcribing'
      : file.kind === 'TRANSCRIPT'
        ? 'Processing'
        : 'Queued';
  return (
    <Chip size="sm" variant="soft">
      <Spinner aria-hidden color="current" size="sm" />
      {label}
    </Chip>
  );
}

// A recording's player, with its transcript alongside once it is READY:
// clicking a line seeks there, and the line being spoken is highlighted.
// Video and transcript sit side by side on wide screens; audio's player is a
// single bar, so its transcript goes underneath.
function RecordingView({ file }: { file: ListedMeetingFile }) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const isVideo = file.mimeType.startsWith('video/');
  const transcript = file.status === 'READY' ? file.transcript : null;

  const seek = (seconds: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = seconds;
    setCurrentTime(seconds);
    // Autoplay rules may refuse; the seek still happened.
    media.play().catch(() => undefined);
  };

  return (
    <div
      className={
        isVideo && transcript
          ? 'grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start'
          : 'flex flex-col gap-3'
      }
    >
      <Player file={file} mediaRef={mediaRef} onTimeUpdate={setCurrentTime} />
      {transcript ? (
        <TranscriptView
          currentTime={currentTime}
          name={file.name}
          transcript={transcript}
          onSeek={seek}
        />
      ) : file.status === 'QUEUED' || file.status === 'TRANSCRIBING' ? (
        <p className="text-sm text-muted">The transcript appears here once it is ready.</p>
      ) : null}
    </div>
  );
}

// Why processing failed, and a Retry that sends the file back to the queue.
function FailedNote({ meetingId, file }: { meetingId: string; file: ListedMeetingFile }) {
  const router = useRouter();
  const [isPending, startRetry] = useTransition();
  const [retryError, setRetryError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-danger">{retryError ?? file.error ?? 'Processing failed.'}</span>
      <Button
        className="-ml-2 h-11"
        isPending={isPending}
        size="sm"
        variant="ghost"
        onPress={() =>
          startRetry(async () => {
            const result = await retryFile(meetingId, file.id);
            if (result.ok) {
              setRetryError(null);
              router.refresh();
            } else {
              setRetryError(result.error);
            }
          })
        }
      >
        {isPending ? <Spinner color="current" size="sm" /> : <ArrowRotateRight aria-hidden />}
        Retry
      </Button>
    </div>
  );
}

// <audio> or <video> by type. Keeps the URL it opened with, so a refresh of
// the page (which signs new URLs) does not restart playback; on an error it
// moves to the newest URL once, which also gets past an expired link.
function Player({
  file,
  mediaRef,
  onTimeUpdate,
}: {
  file: ListedMeetingFile;
  mediaRef: RefObject<HTMLMediaElement | null>;
  onTimeUpdate: (seconds: number) => void;
}) {
  const router = useRouter();
  const [src, setSrc] = useState(file.playbackUrl);
  const [failed, setFailed] = useState(false);
  const [isReloading, startReload] = useTransition();

  const onError = () => {
    if (src !== file.playbackUrl) {
      setSrc(file.playbackUrl);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <Alert role="alert" status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>This file did not play.</Alert.Title>
          <Alert.Description>
            The link may have expired, or this browser cannot play this format. Reload the link, or
            download the file instead.
          </Alert.Description>
          <div className="mt-2">
            <Button
              className="h-11"
              isPending={isReloading}
              size="sm"
              variant="secondary"
              onPress={() =>
                startReload(() => {
                  setFailed(false);
                  router.refresh();
                })
              }
            >
              {isReloading ? <Spinner color="current" size="sm" /> : null}
              Reload the link
            </Button>
          </div>
        </Alert.Content>
      </Alert>
    );
  }

  return file.mimeType.startsWith('video/') ? (
    <video
      key={src}
      ref={mediaRef as RefObject<HTMLVideoElement | null>}
      controls
      playsInline
      aria-label={file.name}
      className="max-h-[60vh] w-full rounded-xl bg-black"
      preload="metadata"
      src={src}
      onError={onError}
      onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
    />
  ) : (
    <audio
      key={src}
      ref={mediaRef as RefObject<HTMLAudioElement | null>}
      controls
      aria-label={file.name}
      className="w-full"
      preload="metadata"
      src={src}
      onError={onError}
      onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
    />
  );
}

// Confirms a delete. Stays open while it runs and shows a failure in place.
export function DeleteFileDialog({
  file,
  onConfirm,
  onClose,
}: {
  file: ListedMeetingFile | null;
  onConfirm: (file: ListedMeetingFile) => Promise<string | null>;
  onClose: () => void;
}) {
  const [isPending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isPending) return;
    setError(null);
    onClose();
  };

  return (
    <AlertDialog.Backdrop isOpen={file !== null} onOpenChange={(open) => (open ? null : close())}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[420px]">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Delete this file?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <p className="break-words">
              <strong>{file?.name}</strong> will be removed from this meeting and from storage. This
              cannot be undone.
            </p>
            {error ? (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{error}</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button className="h-11" isDisabled={isPending} variant="tertiary" onPress={close}>
              Keep it
            </Button>
            <Button
              className="h-11"
              isPending={isPending}
              variant="danger"
              onPress={() =>
                file &&
                startDelete(async () => {
                  const failure = await onConfirm(file);
                  setError(failure);
                })
              }
            >
              {isPending ? <Spinner color="current" size="sm" /> : null}
              Delete
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
