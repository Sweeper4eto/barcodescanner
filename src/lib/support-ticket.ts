/** Ticket number shown to users and admins, e.g. `#SUP-CMVEVMG6`. */
export function formatSupportTicketNumber(ticketId: string): string {
  const short = ticketId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return short ? `#SUP-${short}` : "#SUP---------";
}
