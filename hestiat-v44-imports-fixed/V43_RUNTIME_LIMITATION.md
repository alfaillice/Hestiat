# V43 runtime limitation

The source and migration chain were statically validated, but this execution environment does not provide Docker. Therefore PostgreSQL/PostGIS/Redis could not be started and `prisma migrate deploy` could not be executed here.

Run the commands in the V43 staging runbook on a machine with Docker.
