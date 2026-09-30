'use client';

import { Plus } from '@gravity-ui/icons';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  type Key,
  Input,
  InputGroup,
  Label,
  Spinner,
  Tag,
  TagGroup,
  TextField,
} from '@heroui/react';
import { type DateValue, getLocalTimeZone } from '@internationalized/date';
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createMeeting, type CreateMeetingState } from './actions';
import { MeetingDateField } from './meeting-date-field';

const initialState: CreateMeetingState = {};

// Mirror the API's CreateMeetingDto limits.
const TITLE_MAX = 200;
const PARTICIPANTS_MAX = 100;
const EMAIL_MAX = 254;

// The HTML spec's pattern for <input type="email">. The field itself is
// type="text": an email input strips the newlines of a pasted column.
const EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const SEPARATORS = /[\s,;]+/;

export function NewMeetingForm() {
  const [state, formAction, isPending] = useActionState(createMeeting, initialState);
  const [date, setDate] = useState<DateValue | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  // The participants error, from the client check or the last server answer.
  // Local, so editing the field or the list clears it.
  const [participantError, setParticipantError] = useState<string>();
  const [answeredState, setAnsweredState] = useState(state);
  if (state !== answeredState) {
    setAnsweredState(state);
    setParticipantError(state.fieldErrors?.participants);
  }
  const formRef = useRef<HTMLFormElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  // Native validation focuses the first invalid field on submit; do the same
  // when the server rejects a field, so screen readers read its error.
  useEffect(() => {
    if (state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  // Adds every address in `text` (a paste may hold several) and leaves the
  // ones it could not add in the field, with the reason. Duplicates are
  // dropped quietly: their tag is already there.
  const addParticipants = (text: string): { list: string[]; rejected: number } => {
    const next = [...participants];
    const rejected: string[] = [];
    let error: string | undefined;
    for (const email of text.split(SEPARATORS).filter(Boolean)) {
      if (!EMAIL.test(email) || email.length > EMAIL_MAX) {
        rejected.push(email);
        error ??= `“${email}” is not an email address. Use one like name@company.com.`;
      } else if (next.some((p) => p.toLowerCase() === email.toLowerCase())) {
      } else if (next.length >= PARTICIPANTS_MAX) {
        rejected.push(email);
        error ??= `A meeting can have up to ${PARTICIPANTS_MAX} participants.`;
      } else {
        next.push(email);
      }
    }
    setParticipants(next);
    setDraft(rejected.join(', '));
    setParticipantError(error);
    return { list: next, rejected: rejected.length };
  };

  const onDraftKeyDown = (event: KeyboardEvent) => {
    // Enter would submit the form; here it confirms the address instead.
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (draft.trim()) addParticipants(draft);
    }
  };

  // A pasted list (commas, spaces or one per line) becomes tags at once; a
  // single pasted address stays in the field to be checked or edited.
  const onDraftPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (text.trim().split(SEPARATORS).length > 1) {
      event.preventDefault();
      addParticipants(`${draft} ${text}`);
    }
  };

  const onRemoveParticipants = (keys: Set<Key>) => {
    setParticipants((list) => list.filter((p) => !keys.has(p)));
    setParticipantError(undefined);
    draftRef.current?.focus();
  };

  // Submitting via onSubmit rather than `action`: React resets a form after
  // its `action` runs, which would wipe the fields when the API rejects them.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // An address still in the field counts too, as long as it is valid.
    const { list, rejected } = draft.trim()
      ? addParticipants(draft)
      : { list: participants, rejected: 0 };
    if (rejected > 0) {
      draftRef.current?.focus();
      return;
    }
    if (!date) return;

    const formData = new FormData(event.currentTarget);
    formData.set('date', date.toDate(getLocalTimeZone()).toISOString());
    formData.delete('participants');
    for (const email of list) formData.append('participants', email);
    startTransition(() => formAction(formData));
  };

  return (
    <Form
      ref={formRef}
      className="flex flex-col gap-6"
      validationErrors={state.fieldErrors}
      onSubmit={onSubmit}
    >
      {state.formError ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{state.formError}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      <TextField
        fullWidth
        isRequired
        maxLength={TITLE_MAX}
        name="title"
        validate={(value) => (value.trim() ? null : 'Enter a title for the meeting.')}
      >
        <Label>Title</Label>
        <Input className="h-11" placeholder="Weekly product sync" />
        <FieldError>
          {({ validationDetails, validationErrors }) =>
            validationDetails.valueMissing
              ? 'Enter a title for the meeting.'
              : validationErrors.join(' ')
          }
        </FieldError>
      </TextField>

      <MeetingDateField value={date} onChange={setDate} />

      <div className="flex flex-col gap-3">
        <TextField
          fullWidth
          autoComplete="email"
          inputMode="email"
          isInvalid={participantError ? true : undefined}
          type="text"
          value={draft}
          onChange={(value) => {
            setDraft(value);
            setParticipantError(undefined);
          }}
          onKeyDown={onDraftKeyDown}
        >
          <Label>Participants</Label>
          <InputGroup fullWidth className="h-11">
            <InputGroup.Input
              ref={draftRef}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="name@company.com"
              onPaste={onDraftPaste}
            />
            <InputGroup.Suffix className="pe-0">
              <Button
                className="h-11"
                isDisabled={!draft.trim()}
                size="sm"
                variant="ghost"
                onPress={() => addParticipants(draft)}
              >
                <Plus aria-hidden />
                Add
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <Description>Optional. Press Enter after each email, or paste a list.</Description>
          <FieldError>{participantError}</FieldError>
        </TextField>

        {participants.length > 0 ? (
          <TagGroup aria-label="Added participants" onRemove={onRemoveParticipants}>
            <TagGroup.List items={participants.map((email) => ({ email }))}>
              {({ email }) => (
                <Tag id={email} textValue={email}>
                  <span className="max-w-64 truncate">{email}</span>
                </Tag>
              )}
            </TagGroup.List>
          </TagGroup>
        ) : null}
      </div>

      <Button fullWidth className="mt-2" isPending={isPending} size="lg" type="submit">
        {({ isPending: pending }) =>
          pending ? (
            <>
              <Spinner color="current" size="sm" />
              Creating meeting…
            </>
          ) : (
            'Create meeting'
          )
        }
      </Button>
    </Form>
  );
}
