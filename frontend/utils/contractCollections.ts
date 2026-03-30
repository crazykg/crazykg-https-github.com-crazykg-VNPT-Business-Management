import type { Contract } from '../types';

const matchesContractId = (candidate: Contract, targetId: string | number): boolean =>
  String(candidate.id) === String(targetId);

export const replaceContractInCollection = (
  contracts: Contract[],
  updatedContract: Contract
): Contract[] => {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return contracts || [];
  }

  return contracts.map((contract) => (
    matchesContractId(contract, updatedContract.id)
      ? updatedContract
      : contract
  ));
};

export const prependContractInCollection = (
  contracts: Contract[],
  createdContract: Contract
): Contract[] => [
  createdContract,
  ...(contracts || []).filter((contract) => !matchesContractId(contract, createdContract.id)),
];
