-- Store host-provided check-in/access instructions for guests and Hestiat IA.
ALTER TABLE "Listing" ADD COLUMN "checkInInstructions" JSONB;
