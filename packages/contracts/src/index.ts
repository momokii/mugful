export const shellKinds = {
  api: "API",
  web: "web",
} as const;

export type ShellKind = keyof typeof shellKinds;

export const applicationShellLabel = (kind: ShellKind): string =>
  `Mugful ${shellKinds[kind]} tooling shell`;
