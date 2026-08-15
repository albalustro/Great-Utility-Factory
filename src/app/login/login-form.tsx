"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, signUp, type AuthState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Working…" : children}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [signInState, signInAction] = useActionState(signIn, initialState);
  const [signUpState, signUpAction] = useActionState(signUp, initialState);

  const state = signInState.error || signInState.message ? signInState : signUpState;

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={signInAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
            />
          </div>

          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          {state.message ? (
            <Alert variant="info">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <SubmitButton>Sign in</SubmitButton>

          <Button
            type="submit"
            formAction={signUpAction}
            variant="outline"
            className="w-full"
          >
            Create the operator account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
