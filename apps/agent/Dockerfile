# Build from repository root:
#   docker build -f apps/agent/Dockerfile -t gmail-agent:latest .
#
# AWS Lambda: create function from container image, set handler override if needed.
# Base image expects CMD ["file.exportedName"] relative to LAMBDA_TASK_ROOT.

FROM public.ecr.aws/lambda/nodejs:20

WORKDIR ${LAMBDA_TASK_ROOT}

ARG DATABASE_URL
ARG DIRECT_URL
ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DIRECT_URL}

COPY package.json package-lock.json* ./
COPY packages/db/package.json ./packages/db/
COPY packages/rule-conditions/package.json ./packages/rule-conditions/
COPY packages/email-templates/package.json ./packages/email-templates/
COPY apps/agent/package.json ./apps/agent/

COPY packages/db/prisma ./packages/db/prisma
COPY packages/db/src ./packages/db/src
COPY packages/rule-conditions ./packages/rule-conditions
COPY packages/email-templates ./packages/email-templates
COPY apps/agent ./apps/agent

RUN npm install

WORKDIR ${LAMBDA_TASK_ROOT}/packages/db
RUN npx prisma generate

WORKDIR ${LAMBDA_TASK_ROOT}
RUN npm prune --omit=dev

# Handler path is relative to LAMBDA_TASK_ROOT (/var/task), not WORKDIR.
CMD ["apps/agent/index.handler"]
