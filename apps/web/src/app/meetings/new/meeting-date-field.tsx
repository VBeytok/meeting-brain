'use client';

import {
  Calendar,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Label,
  Skeleton,
  TimeField,
  type TimeValue,
} from '@heroui/react';
import { type DateValue, getLocalTimeZone, now } from '@internationalized/date';
import { useState, useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// Date and time of the meeting, in the browser's timezone. Rendered on the
// client only: the segments follow the browser's locale and timezone, which
// the server does not know, so server HTML would not match (Node and the
// browser even disagree on the space before AM/PM).
export function MeetingDateField({
  value,
  onChange,
}: {
  value: DateValue | null;
  onChange: (value: DateValue | null) => void;
}) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!isClient) {
    return (
      <div aria-hidden className="flex flex-col gap-1">
        <span className="text-sm font-medium">Date and time</span>
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="mt-1 h-4 w-48 rounded" />
      </div>
    );
  }
  return <DateTimePicker value={value} onChange={onChange} />;
}

function DateTimePicker({
  value,
  onChange,
}: {
  value: DateValue | null;
  onChange: (value: DateValue | null) => void;
}) {
  // The calendar opens on the current hour when nothing is picked yet.
  const [placeholder] = useState(() =>
    now(getLocalTimeZone()).set({ minute: 0, second: 0, millisecond: 0 }),
  );

  return (
    <DatePicker
      hideTimeZone
      isRequired
      className="w-full"
      granularity="minute"
      name="date"
      placeholderValue={placeholder}
      value={value}
      onChange={onChange}
    >
      {({ state }) => (
        <>
          <Label>Date and time</Label>
          <DateField.Group fullWidth className="h-11">
            <DateField.Input>
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
            <DateField.Suffix>
              <DatePicker.Trigger aria-label="Open calendar" className="size-11">
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <Description>In your timezone ({placeholder.timeZone}).</Description>
          <FieldError>
            {({ validationDetails, validationErrors }) =>
              validationDetails.valueMissing
                ? 'Pick the date and time of the meeting.'
                : validationErrors.join(' ')
            }
          </FieldError>
          <DatePicker.Popover className="flex flex-col gap-3">
            <Calendar aria-label="Meeting date">
              <Calendar.Header>
                <Calendar.YearPickerTrigger>
                  <Calendar.YearPickerTriggerHeading />
                  <Calendar.YearPickerTriggerIndicator />
                </Calendar.YearPickerTrigger>
                <Calendar.NavButton slot="previous" />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>
                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>{(day) => <Calendar.Cell date={day} />}</Calendar.GridBody>
              </Calendar.Grid>
              <Calendar.YearPickerGrid>
                <Calendar.YearPickerGridBody>
                  {({ year }) => <Calendar.YearPickerCell year={year} />}
                </Calendar.YearPickerGridBody>
              </Calendar.YearPickerGrid>
            </Calendar>
            {/* With minute granularity the picker only commits once a time is set too. */}
            <div className="flex items-center justify-between gap-3">
              <Label>Time</Label>
              <TimeField
                hideTimeZone
                aria-label="Time"
                granularity="minute"
                value={state.timeValue}
                onChange={(time) => state.setTimeValue(time as TimeValue)}
              >
                <TimeField.Group variant="secondary">
                  <TimeField.Input>
                    {(segment) => <TimeField.Segment segment={segment} />}
                  </TimeField.Input>
                </TimeField.Group>
              </TimeField>
            </div>
          </DatePicker.Popover>
        </>
      )}
    </DatePicker>
  );
}
