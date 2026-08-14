/**
 * CDP accessibility tree → simulated screen-reader announcement strings.
 *
 * KNOWN CONSTRAINT (stated honestly in the UI): JAWS/NVDA/VoiceOver cannot
 * run in a Linux container. This is accurate for structure, roles, and
 * naming — it is not a real screen-reader run. RunMetadata.screenReaderNote
 * carries this disclaimer through to the report.
 */
import type { Page } from "playwright";

interface AXNode {
  nodeId: string;
  role?: { value: string };
  name?: { value: string };
  backendDOMNodeId?: number;
  childIds?: string[];
}

export async function buildAnnouncementIndex(page: Page): Promise<Map<number, string>> {
  const client = await page.context().newCDPSession(page);
  await client.send("Accessibility.enable");
  const { nodes } = (await client.send("Accessibility.getFullAXTree")) as { nodes: AXNode[] };

  const index = new Map<number, string>();
  for (const node of nodes) {
    if (!node.backendDOMNodeId) continue;
    const role = node.role?.value ?? "";
    const name = node.name?.value ?? "";
    if (!role && !name) continue;
    index.set(node.backendDOMNodeId, [name, role].filter(Boolean).join(", "));
  }

  await client.detach().catch(() => {});
  return index;
}

/** Convenience: announcement for whatever currently has focus. */
export async function announcementForActiveElement(page: Page): Promise<string> {
  const client = await page.context().newCDPSession(page);
  await client.send("Accessibility.enable");
  try {
    // getPartialAXTree without a backendNodeId/objectId returns the whole
    // tree rooted at the document; the focused node isn't singled out by
    // CDP directly, so we cross-reference document.activeElement's
    // backendNodeId (resolved via DOM.describeNode) against the AX nodes.
    const dom = await client.send("DOM.getDocument", { depth: -1, pierce: true });
    const activeHandle = await page.evaluateHandle(() => document.activeElement);
    const objectId = (activeHandle as any)._objectId ?? undefined;

    const { nodes } = (await client.send("Accessibility.getPartialAXTree", {
      objectId,
    } as any)) as { nodes: AXNode[] };

    const focused = nodes?.[0];
    const role = focused?.role?.value ?? "";
    const name = focused?.name?.value ?? "";
    return [name, role].filter(Boolean).join(", ") || "unlabeled element";
  } catch {
    return "unlabeled element";
  } finally {
    await client.detach().catch(() => {});
  }
}
