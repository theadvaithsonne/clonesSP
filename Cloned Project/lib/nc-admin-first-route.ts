/** Landing route for the NetworkChains dashboard — the first entry in
 *  NC_NAV's own sidebar order (Users). The type switcher and the
 *  `/garage-admin/networkchains` index both read this constant, and the
 *  Users entry in NC_NAV is bound to it directly, so the landing route
 *  and the first entry can never drift apart. */
export const NC_FIRST_HREF = "/garage-admin/networkchains/users";
