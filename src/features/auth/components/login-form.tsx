"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/features/auth/components/form-field";
import { useAuth, useLogin } from "@/features/auth/hooks/use-auth";
import { collectFieldErrors, loginBodySchema } from "@/features/auth/schemas/auth.schemas";
import { USER_ROLE_LABELS } from "@/features/auth/types";

type FieldName = "email" | "password";

export function LoginForm({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const auth = useAuth();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = loginBodySchema.safeParse({ email, password });

    if (!parsed.success) {
      const errors = collectFieldErrors(parsed.error);
      setFieldErrors({ email: errors.email, password: errors.password });
      return;
    }

    setFieldErrors({});
    login.mutate(parsed.data, {
      onSuccess: () => {
        router.push(nextPath);
        router.refresh();
      },
    });
  }

  if (auth.user) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Alert tone="success" title="Bạn đã đăng nhập">
            <p>
              Tài khoản <strong>{auth.user.email}</strong> ({USER_ROLE_LABELS[auth.user.role]}) đang
              hoạt động.
            </p>
          </Alert>
          <Button className="w-full" onClick={() => router.push(nextPath)}>
            Tiếp tục
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        {auth.locked ? (
          <Alert tone="error" title="Tài khoản đã bị khoá">
            Tài khoản đang đăng nhập trên trình duyệt này đã bị khoá. Hãy liên hệ quản trị viên.
          </Alert>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <FormField
            id="login-email"
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="hocsinh@example.com"
            value={email}
            error={fieldErrors.email}
            disabled={login.isPending}
            onChange={(event) => setEmail(event.target.value)}
          />

          <FormField
            id="login-password"
            label="Mật khẩu"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            error={fieldErrors.password}
            disabled={login.isPending}
            onChange={(event) => setPassword(event.target.value)}
          />

          {login.isError ? (
            <Alert tone="error" title="Đăng nhập không thành công">
              {login.error.message}
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600">
          Chưa có tài khoản?{" "}
          <Link
            href="/dang-ky"
            className="font-semibold text-sky-700 underline-offset-4 hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
