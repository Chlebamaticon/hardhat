import type { EthereumProvider } from "hardhat/types";

import { expect, assert } from "chai";
import sinon from "sinon";
import * as chains from "viem/chains";

import { getChain, isDevelopmentNetwork } from "../src/internal/chains";
import { EthereumMockedProvider } from "./mocks/provider";

describe("chains", () => {
  describe("getChain", () => {
    afterEach(sinon.restore);

    it("should return the chain corresponding to the chain id", async () => {
      const provider: EthereumProvider = new EthereumMockedProvider();
      const sendStub = sinon.stub(provider, "send");
      sendStub.withArgs("eth_chainId").returns(Promise.resolve("0x1")); // mainnet chain id
      sendStub.withArgs("hardhat_metadata").throws();
      sendStub.withArgs("anvil_nodeInfo").throws();

      const chain = await getChain(provider);

      expect(chain).to.deep.equal(chains.mainnet);
    });

    it("should return the hardhat chain if the chain id is 31337 and the network is hardhat", async () => {
      const provider: EthereumProvider = new EthereumMockedProvider();
      const sendStub = sinon.stub(provider, "send");
      sendStub.withArgs("eth_chainId").returns(Promise.resolve("0x7a69")); // 31337 in hex
      sendStub.withArgs("hardhat_metadata").returns(Promise.resolve({}));
      sendStub.withArgs("anvil_nodeInfo").throws();

      const chain = await getChain(provider);

      expect(chain).to.deep.equal(chains.hardhat);
    });

    it("should return the foundry chain if the chain id is 31337 and the network is foundry", async () => {
      const provider: EthereumProvider = new EthereumMockedProvider();
      const sendStub = sinon.stub(provider, "send");
      sendStub.withArgs("eth_chainId").returns(Promise.resolve("0x7a69")); // 31337 in hex
      sendStub.withArgs("hardhat_metadata").throws();
      sendStub.withArgs("anvil_nodeInfo").returns(Promise.resolve({}));

      const chain = await getChain(provider);

      expect(chain).to.deep.equal(chains.foundry);
    });

    it("should throw if the chain id is 31337 and the network is neither hardhat nor foundry", async () => {
      const provider: EthereumProvider = new EthereumMockedProvider();
      const sendStub = sinon.stub(provider, "send");
      sendStub.withArgs("eth_chainId").returns(Promise.resolve("0x7a69")); // 31337 in hex
      sendStub.withArgs("hardhat_metadata").throws();
      sendStub.withArgs("anvil_nodeInfo").throws();

      await expect(getChain(provider)).to.be.rejectedWith(
        `The chain id corresponds to a development network but we couldn't detect which one.
Please report this issue if you're using Hardhat or Foundry.`
      );
    });

    it("should throw if the chain id is not 31337 and there is no chain with that id", async () => {
      const provider: EthereumProvider = new EthereumMockedProvider();
      const sendStub = sinon.stub(provider, "send");
      sendStub.withArgs("eth_chainId").returns(Promise.resolve("0x0")); // fake chain id 0
      sendStub.withArgs("hardhat_metadata").throws();
      sendStub.withArgs("anvil_nodeInfo").throws();

      await expect(getChain(provider)).to.be.rejectedWith(
        /No network with chain id 0 found/
      );
    });

    it("should throw if the chain id is not 31337 and there are multiple chains with that id", async () => {
      const provider: EthereumProvider = new EthereumMockedProvider();
      const sendStub = sinon.stub(provider, "send");
      // chain id 999 corresponds to Wanchain Testnet but also Zora Goerli Testnet
      sendStub.withArgs("eth_chainId").returns(Promise.resolve("0x3e7"));
      sendStub.withArgs("hardhat_metadata").throws();
      sendStub.withArgs("anvil_nodeInfo").throws();

      await expect(getChain(provider)).to.be.rejectedWith(
        /Multiple networks with chain id 999 found./
      );
    });
  });

  describe("isDevelopmentNetwork", () => {
    it("should return true if the chain id is 31337", () => {
      assert.ok(isDevelopmentNetwork(31337));
    });

    it("should return false if the chain id is not 31337", () => {
      assert.notOk(isDevelopmentNetwork(1));
    });
  });
});
