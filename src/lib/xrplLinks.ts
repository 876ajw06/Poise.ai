/** Official faucet hub (generates credentials + links to top-up tools). */
export const XRPL_FAUCETS_PAGE = "https://xrpl.org/resources/dev-tools/xrp-faucets";

/** Top up an existing testnet address (works well with wallets / shared destination). */
export const XRPL_TESTNET_TOPUP_FAUCET = "https://test.xrplexplorer.com/faucet";

/** Account pages that stay stable when older xrpl.org explorer paths break. */
export function xrplAccountExplorerUrl(network: "testnet" | "mainnet", address: string): string {
  if (network === "testnet") {
    return `https://test.xrplexplorer.com/explorer/${address}`;
  }
  return `https://xrpscan.com/account/${address}`;
}

/** Open a validated transaction in a browser explorer. */
export function xrplTxExplorerUrl(network: "testnet" | "mainnet", txHash: string): string {
  if (network === "testnet") {
    return `https://test.xrplexplorer.com/explorer/${txHash}`;
  }
  return `https://xrpscan.com/tx/${txHash}`;
}
