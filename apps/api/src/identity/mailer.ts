import nodemailer from "nodemailer";

export type IdentityEmail = Readonly<{
  subject: string;
  text: string;
  to: string;
}>;

export type IdentityMailer = Readonly<{
  send: (email: IdentityEmail) => Promise<void>;
}>;

export type SmtpConfiguration = Readonly<{
  from: string;
  host: string;
  password: string | undefined;
  port: number;
  secure: boolean;
  username: string | undefined;
}>;

export const createSmtpMailer = (
  configuration: SmtpConfiguration,
): IdentityMailer => {
  const transporter = nodemailer.createTransport({
    auth:
      configuration.username === undefined
        ? undefined
        : { pass: configuration.password, user: configuration.username },
    connectionTimeout: 3_000,
    greetingTimeout: 3_000,
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    socketTimeout: 5_000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });

  return {
    send: async (email) => {
      await transporter.sendMail({
        from: configuration.from,
        subject: email.subject,
        text: email.text,
        to: email.to,
      });
    },
  };
};
