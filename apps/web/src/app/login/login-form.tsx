'use client';

import { ArrowRight, Eye, EyeSlash } from '@gravity-ui/icons';
import {
  Alert,
  Button,
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
import { login, type LoginState } from './actions';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);
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
        autoComplete="current-password"
        name="password"
        type={isPasswordVisible ? 'text' : 'password'}
      >
        <Label>Password</Label>
        <InputGroup fullWidth className="h-11">
          <InputGroup.Input placeholder="Your password" />
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
        <FieldError>
          {({ validationDetails, validationErrors }) =>
            validationDetails.valueMissing ? 'Enter your password.' : validationErrors.join(' ')
          }
        </FieldError>
      </TextField>

      <Button fullWidth className="mt-1" isPending={isPending} size="lg" type="submit">
        {({ isPending: pending }) =>
          pending ? (
            <>
              <Spinner color="current" size="sm" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight />
            </>
          )
        }
      </Button>
    </Form>
  );
}
