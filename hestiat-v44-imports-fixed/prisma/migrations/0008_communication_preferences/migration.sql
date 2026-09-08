CREATE TABLE "CommunicationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailTransactional" BOOLEAN NOT NULL DEFAULT true,
  "whatsappTransactional" BOOLEAN NOT NULL DEFAULT false,
  "emailMarketing" BOOLEAN NOT NULL DEFAULT false,
  "whatsappMarketing" BOOLEAN NOT NULL DEFAULT false,
  "whatsappOptInAt" TIMESTAMP(3),
  "whatsappOptOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunicationPreference_userId_key" UNIQUE ("userId"),
  CONSTRAINT "CommunicationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
