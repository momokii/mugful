import fastify from "fastify";

export type DatabaseChecker = Readonly<{
  check: () => Promise<void>;
}>;

export type AppDependencies = Readonly<{
  databaseChecker: DatabaseChecker;
}>;

export const createApp = (dependencies: AppDependencies) => {
  const app = fastify({ logger: false });

  app.get("/health/live", () => ({ status: "live" }));

  app.get("/health/ready", (_request, reply) =>
    dependencies.databaseChecker
      .check()
      .then(() => reply.code(200).send({ status: "ready" }))
      .catch(() => reply.code(503).send({ status: "unavailable" })),
  );

  app.setErrorHandler((_error, _request, reply) => {
    reply.code(503).send({ status: "unavailable" });
  });

  return app;
};
