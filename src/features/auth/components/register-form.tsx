"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/features/auth/components/form-field";
import { useAuth, useRegister } from "@/features/auth/hooks/use-auth";
import {
  collectFieldErrors,
  MIN_PASSWORD_LENGTH,
  registerFormSchema,
} from "@/features/auth/schemas/auth.schemas";
import { USER_ROLE_LABELS } from "@/features/auth/types";

type FieldName = "name" | "email" | "password" | "confirmPassword";

const EMPTY_FIELDS: Record<FieldName, string> = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function RegisterForm() {
  const router = useRouter();
  const auth = useAuth();
  const register = useRegister();

  const [fields, setFields] = useState<Record<FieldName, string>>(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  function updateField(name: FieldName, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = registerFormSchema.safeParse(fields);

    if (!parsed.success) {
      const errors = collectFieldErrors(parsed.error);
      setFieldErrors({
        name: errors.name,
        email: errors.email,
        password: errors.password,
        confirmPassword: errors.confirmPassword,
      });
      return;
    }

    setFieldErrors({});
    // Mật khẩu nhập lại chỉ dùng để kiểm tra phía trình duyệt nên không gửi lên server.
    register.mutate(
      { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password },
      {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      },
    );
  }

  if (auth.user) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Alert tone="success" title="Bạn đã đăng nhập">
            <p>
              Tài khoản <strong>{auth.user.email}</strong> ({USER_ROLE_LABELS[auth.user.role]}) đang
              hoạt động. Hãy đăng xuất nếu muốn tạo tài khoản khác.
            </p>
          </Alert>
          <Button className="w-full" onClick={() => router.push("/")}>
            Về trang chủ
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <FormField
            id="register-name"
            label="Họ và tên"
            name="name"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            value={fields.name}
            error={fieldErrors.name}
            disabled={register.isPending}
            onChange={(event) => updateField("name", event.target.value)}
          />

          <FormField
            id="register-email"
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="hocsinh@example.com"
            value={fields.email}
            error={fieldErrors.email}
            disabled={register.isPending}
            onChange={(event) => updateField("email", event.target.value)}
          />

          <FormField
            id="register-password"
            label="Mật khẩu"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="••••••••"
            hint={`Ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`}
            value={fields.password}
            error={fieldErrors.password}
            disabled={register.isPending}
            onChange={(event) => updateField("password", event.target.value)}
          />

          <FormField
            id="register-confirm-password"
            label="Nhập lại mật khẩu"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            value={fields.confirmPassword}
            error={fieldErrors.confirmPassword}
            disabled={register.isPending}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
          />

          {register.isError ? (
            <Alert tone="error" title="Đăng ký không thành công">
              {register.error.message}
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={register.isPending}>
            {register.isPending ? "Đang tạo tài khoản…" : "Tạo tài khoản học sinh"}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600">
          Đã có tài khoản?{" "}
          <Link
            href="/dang-nhap"
            className="font-semibold text-sky-700 underline-offset-4 hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
