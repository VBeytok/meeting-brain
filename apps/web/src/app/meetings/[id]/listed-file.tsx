'use client';

import { ArrowDownToLine, TrashBin } from '@gravity-ui/icons';
import { AlertDialog, Alert, Button, Chip, Spinner } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ListedMeetingFile } from '@/lib/meetings';
import { FileRow } from './file-row';

// A confirmed file: Play (or Open, for a transcript), Download and Delete.
export function ListedFile({
  file,
  isOpen,
  onToggle,
  onDelete,
}: {
  file: ListedMeetingFile;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const panelId = `file-${file.id}-panel`;
  const isRecording = file.kind === 'RECORDING';
  return (
    <FileRow
      below={
        isOpen ? (
          <div className="mt-3" id={panelId}>
            {isRecording ? (
              <Player file={file} />
            ) : (
              <p className="rounded-xl bg-surface-secondary px-4 py-3 text-sm text-muted">
                Reading transcripts here comes once processing is added. For now, download the file
                to read it.
              </p>
            )}
          </div>
        ) : null
      }
      kind={file.kind}
      mimeType={file.mimeType}
      name={file.name}
      size={file.size}
      status={
        <Chip size="sm" variant="soft">
          Queued
        </Chip>
      }
    >
      <div className="flex shrink-0 items-center">
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

// <audio> or <video> by type. Keeps the URL it opened with, so a refresh of
// the page (which signs new URLs) does not restart playback; on an error it
// moves to the newest URL once, which also gets past an expired link.
function Player({ file }: { file: ListedMeetingFile }) {
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
      controls
      playsInline
      aria-label={file.name}
      className="max-h-[60vh] w-full rounded-xl bg-black"
      preload="metadata"
      src={src}
      onError={onError}
    />
  ) : (
    <audio
      key={src}
      controls
      aria-label={file.name}
      className="w-full"
      preload="metadata"
      src={src}
      onError={onError}
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
