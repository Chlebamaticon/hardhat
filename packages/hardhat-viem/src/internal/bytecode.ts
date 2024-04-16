import type * as viemT from "viem";

import { Artifact } from "hardhat/types/artifacts";

import {
  AmbigousLibraryNameError,
  MissingLibraryAddressError,
  InvalidLibraryAddressError,
  OverlappingLibraryNamesError,
  UnnecessaryLibraryLinkError,
} from "./errors";

type Libraries<Address = string> = {
  [libraryName: string]: Address;
};

interface Link {
  sourceName: string;
  libraryName: string;
  address: string;
}

export function linkBytecode(artifact: Artifact, libraries: Link[]): string {
  let bytecode = artifact.bytecode;

  // TODO: measure performance impact
  for (const { sourceName, libraryName, address } of libraries) {
    const linkReferences = artifact.linkReferences[sourceName][libraryName];
    for (const { start, length } of linkReferences) {
      bytecode =
        bytecode.substring(0, 2 + start * 2) +
        address.substring(2) +
        bytecode.substring(2 + (start + length) * 2);
    }
  }

  return bytecode;
}

export async function throwOnAmbigousLibraryNameOrUnnecessaryLink(
  contractName: string,
  libraries: Libraries<viemT.Address>,
  neededLibraries: Array<Pick<Link, "libraryName" | "sourceName">>
) {
  for (const linkedLibraryName of Object.keys(libraries)) {
    const matchingLibraries = neededLibraries.filter(
      ({ sourceName, libraryName }) =>
        libraryName === linkedLibraryName ||
        `${sourceName}:${libraryName}` === linkedLibraryName
    );

    if (matchingLibraries.length > 1) {
      throw new AmbigousLibraryNameError(
        contractName,
        linkedLibraryName,
        matchingLibraries.map(
          ({ sourceName, libraryName }) => `${sourceName}:${libraryName}`
        )
      );
    } else if (matchingLibraries.length === 0) {
      throw new UnnecessaryLibraryLinkError(contractName, linkedLibraryName);
    }
  }
}

export async function throwOnMissingLibrariesAddress(
  contractName: string,
  libraries: Libraries<viemT.Address>,
  neededLibraries: Array<Pick<Link, "libraryName" | "sourceName">>
) {
  const missingLibraries = [];
  for (const { sourceName, libraryName } of neededLibraries) {
    const address =
      libraries[`${sourceName}:${libraryName}`] ?? libraries[libraryName];

    if (address === undefined) {
      missingLibraries.push({ sourceName, libraryName });
    }
  }

  if (missingLibraries.length > 0) {
    throw new MissingLibraryAddressError(contractName, missingLibraries);
  }
}

export async function throwOnInvalidLibrariesAddress(
  contractName: string,
  libraries: Libraries<viemT.Address>,
  neededLibraries: Link[]
) {
  const librariesWithInvalidAddress = [];
  for (const { sourceName, libraryName } of neededLibraries) {
    const address =
      libraries[`${sourceName}:${libraryName}`] ?? libraries[libraryName];

    if (address === undefined) {
      librariesWithInvalidAddress.push({ sourceName, libraryName, address });
    }
  }

  if (librariesWithInvalidAddress.length > 0) {
    throw new InvalidLibraryAddressError(
      contractName,
      librariesWithInvalidAddress
    );
  }
}

export async function throwOnOverlappingLibraryNames(
  contractName: string,
  libraries: Libraries<viemT.Address>,
  neededLibraries: Array<Pick<Link, "libraryName" | "sourceName">>
) {
  for (const { sourceName, libraryName } of neededLibraries) {
    if (
      libraries[`${sourceName}:${libraryName}`] !== undefined &&
      libraries[libraryName] !== undefined
    ) {
      throw new OverlappingLibraryNamesError(sourceName, libraryName);
    }
  }
}

export async function resolveBytecodeWithLinkedLibraries(
  artifact: Artifact,
  libraries: Libraries<viemT.Address>
): Promise<string> {
  const { linkReferences } = artifact;

  const neededLibraries: Array<Omit<Link, "address">> = [];
  for (const [sourceName, sourceLibraries] of Object.entries(linkReferences)) {
    for (const [libraryName] of Object.entries(sourceLibraries)) {
      neededLibraries.push({
        sourceName,
        libraryName,
      });
    }
  }

  await throwOnAmbigousLibraryNameOrUnnecessaryLink(
    artifact.contractName,
    libraries,
    neededLibraries
  );
  await throwOnOverlappingLibraryNames(
    artifact.contractName,
    libraries,
    neededLibraries
  );
  await throwOnMissingLibrariesAddress(
    artifact.contractName,
    libraries,
    neededLibraries
  );

  const resolvedLibraries: Link[] = neededLibraries.map((link) => ({
    ...link,
    address:
      libraries[`${link.sourceName}:${link.libraryName}`] ??
      libraries[link.libraryName],
  }));

  await throwOnInvalidLibrariesAddress(
    artifact.contractName,
    libraries,
    resolvedLibraries
  );

  return linkBytecode(artifact, resolvedLibraries);
}