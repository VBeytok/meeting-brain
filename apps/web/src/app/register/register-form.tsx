'use client';

import { ArrowRight, Eye, EyeSlash } from '@gravity-ui/icons';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';
import { register, type RegisterState } from './actions';

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, initialState);
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Native validation focuses the first invalid field on submit; do the same
  // when the server rejects a field, so screen readers read its error.
  useEffect(() => {
    if (state.fieldErrors) {
      formRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  // Submitting via onSubmit rather than `action`: React resets a form after
  // its `action` runs, which would wipe the fields when the API rejects them.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  return (
    <Form
      ref={formRef}
      className="flex flex-col gap-5"
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
        autoComplete="email"
        maxLength={254}
        name="email"
        type="email"
      >
        <Label>Email</Label>
        <Input className="h-11" placeholder="you@company.com" />
        <FieldError>
          {({ validationDetails, validationErrors }) =>
            validationDetails.valueMissing
              ? 'Enter your email address.'
              : validationDetails.typeMismatch
                ? 'Enter an email address like name@company.com.'
                : validationErrors.join(' ')
          }
        </FieldError>
      </TextField>

      <TextField
        fullWidth
        isRequired
        autoComplete="new-password"
        maxLength={128}
        minLength={8}
        name="password"
        type={isPasswordVisible ? 'text' : 'password'}
      >
        <Label>Password</Label>
        <InputGroup fullWidth className="h-11">
          <InputGroup.Input placeholder="At least 8 characters" />
          <InputGroup.Suffix className="pe-0">
            <Button
              isIconOnly
              className="size-11"
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              size="sm"
              variant="ghost"
              onPress={() => setPasswordVisible((visible) => !visible)}
            >
              {isPasswordVisible ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
        <Description>8 to 128 characters.</Description>
        <FieldError>
          {({ validationDetails, validationErrors }) =>
            validationDetails.valueMissing
              ? 'Enter a password.'
              : validationDetails.tooShort
                ? 'Use at least 8 characters.'
                : validationErrors.join(' ')
          }
        </FieldError>
      </TextField>

      <Button fullWidth className="mt-1" isPending={isPending} size="lg" type="submit">
        {({ isPending: pending }) =>
          pending ? (
            <>
              <Spinner color="current" size="sm" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight />
            </>
          )
        }
      </Button>
    </Form>
  );
}
