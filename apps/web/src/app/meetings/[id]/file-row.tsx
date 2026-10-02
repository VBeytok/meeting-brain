import { File, FileText, Microphone, Video } from '@gravity-ui/icons';
import type { ReactNode } from 'react';
import { formatBytes, kindLabel, type MeetingFileKind } from '@/lib/file-types';

// One line of the files list: icon, name and size, a note under them (an
// error, a progress bar), actions on the right and, optionally, a panel
// below (the player).
export function FileRow({
  name,
  size,
  kind,
  mimeType,
  status,
  note,
  below,
  children,
}: {
  name: string;
  size: number;
  kind?: MeetingFileKind;
  // Picks the video icon for video recordings.
  mimeType?: string;
  status?: ReactNode;
  note?: ReactNode;
  below?: ReactNode;
  children?: ReactNode;
}) {
  // A refused file may have no kind: it gets a plain file icon.
  const Icon =
    kind === 'TRANSCRIPT'
      ? FileText
      : kind === 'RECORDING'
        ? mimeType?.startsWith('video/')
          ? Video
          : Microphone
        : File;
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-secondary text-muted">
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={name}>
            {name}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>
              {kind ? `${kindLabel(kind)} · ` : ''}
              {formatBytes(size)}
            </span>
            {status}
          </p>
          {note ? <div className="mt-1 text-xs">{note}</div> : null}
        </div>
        {children}
      </div>
      {below}
    </li>
  );
}
