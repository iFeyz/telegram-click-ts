import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

let prismaMock: MockPrismaClient;

export function getPrismaMock(): MockPrismaClient {
  if (!prismaMock) {
    prismaMock = mockDeep<PrismaClient>();
  }
  return prismaMock;
}

export function resetPrismaMock(): void {
  if (prismaMock) {
    mockReset(prismaMock);
  }
}

export function createPrismaMock(): MockPrismaClient {
  return mockDeep<PrismaClient>();
}
