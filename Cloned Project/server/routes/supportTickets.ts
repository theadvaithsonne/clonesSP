import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { SupportTicket } from "../models/supportTicket.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Floor } from "../models/floor.model";
import { Types } from "mongoose";
import { getSocketInstance } from "../services/socket";

const router = Router();

// Garage HQ organization ID - members of this org can see all tickets across all orgs
const GARAGE_HQ_ORG_ID = "68f8ee6dc45c74df03e69211";

// Helper function to check if user is founder of an organization
async function isFounderOfOrg(
  userId: string,
  orgId: string
): Promise<boolean> {
  const user = await User.findById(userId).lean();
  if (!user) return false;

  const membership = user.organizations?.find(
    (org: any) => org.organization?.toString() === orgId
  );
  return membership ? hasFounderAccess(membership) : false;
}

// Helper function to check if user is a member of Garage HQ (founder or stakeholder)
async function isGarageHQMember(userId: string): Promise<boolean> {
  const user = await User.findById(userId).lean();
  if (!user) return false;

  const membership = user.organizations?.find(
    (org: any) => org.organization?.toString() === GARAGE_HQ_ORG_ID
  );
  return !!membership; // Returns true if user is a member (any role)
}

// Helper function to check if user is founder of Garage HQ
async function isGarageHQFounder(userId: string): Promise<boolean> {
  return isFounderOfOrg(userId, GARAGE_HQ_ORG_ID);
}

// Create a new support ticket
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = req.query.orgId as string;

    if (!orgId) return res.status(400).json({ error: "No organization" });

    const body = z
      .object({
        subject: z.string().min(1).max(200),
        description: z.string().min(1).max(5000),
        module: z.string().min(1).max(100).default("General"),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        attachments: z.array(z.string()).optional().default([]),
      })
      .parse(req.body);

    const ticket = await SupportTicket.create({
      orgId: new Types.ObjectId(orgId),
      createdBy: new Types.ObjectId(me.userId),
      subject: body.subject,
      description: body.description,
      module: body.module,
      priority: body.priority,
      attachments: body.attachments,
    });

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate("createdBy", "name email profilePicture")
      .lean();

    // Emit socket event for new ticket
    const io = getSocketInstance();
    if (io && populatedTicket) {
      // Notify org founders/admins about new ticket
      io.to(`support:org:${orgId}`).emit("support:new-ticket", {
        ticket: populatedTicket,
      });
      // Also notify global admins (Garage HQ)
      io.to("support:global").emit("support:new-ticket", {
        ticket: populatedTicket,
      });
      console.log(`[SUPPORT] Emitted new-ticket event for ticket ${ticket._id}`);
    }

    res.status(201).json({ ticket: populatedTicket });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// Get tickets for the current user (their own tickets)
router.get("/my", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = req.query.orgId as string;

    if (!orgId) return res.status(400).json({ error: "No organization" });

    const tickets = await SupportTicket.find({
      orgId: new Types.ObjectId(orgId),
      createdBy: new Types.ObjectId(me.userId),
    })
      .populate("createdBy", "name email profilePicture")
      .populate("responses.respondedBy", "name email profilePicture")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ tickets });
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// Get all tickets for the organization (founders only)
router.get("/all", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = req.query.orgId as string;

    if (!orgId) return res.status(400).json({ error: "No organization" });

    // Check if user is founder or global admin
    const isFounder = await isFounderOfOrg(me.userId, orgId);
    const isGlobalAdmin = await isGarageHQMember(me.userId);

    if (!isFounder && !isGlobalAdmin) {
      return res.status(403).json({ error: "Only founders can view all tickets" });
    }

    const tickets = await SupportTicket.find({
      orgId: new Types.ObjectId(orgId),
    })
      .populate("createdBy", "name email profilePicture")
      .populate("responses.respondedBy", "name email profilePicture")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ tickets });
  } catch (error) {
    console.error("Error fetching all tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// Get ALL tickets across ALL organizations (Garage HQ members only)
router.get("/global", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    // Check if user is a member of Garage HQ (founder or stakeholder)
    const isGarageHQ = await isGarageHQMember(me.userId);
    if (!isGarageHQ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get all tickets with organization info
    const tickets = await SupportTicket.find({})
      .populate("createdBy", "name email profilePicture")
      .populate("responses.respondedBy", "name email profilePicture")
      .populate("assignedTo", "name email profilePicture")
      .populate("assignedToFloor", "name level")
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Get organization names for each ticket
    const orgIds = [...new Set(tickets.map((t) => t.orgId.toString()))];
    const organizations = await Organization.find({
      _id: { $in: orgIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("name")
      .lean();

    const orgMap = new Map(organizations.map((o) => [o._id.toString(), o.name]));

    // Add organization name to each ticket
    const ticketsWithOrgName = tickets.map((ticket) => ({
      ...ticket,
      orgName: orgMap.get(ticket.orgId.toString()) || "Unknown Organization",
    }));

    res.json({ tickets: ticketsWithOrgName, isGarageHQMember: true });
  } catch (error) {
    console.error("Error fetching global tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// Check if user is a Garage HQ member (can see all tickets and assign)
router.get("/check-global-admin", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const isGarageHQ = await isGarageHQMember(me.userId);
    // Return isGlobalAdmin for backward compatibility with frontend
    res.json({ isGlobalAdmin: isGarageHQ, isGarageHQMember: isGarageHQ });
  } catch (error) {
    console.error("Error checking Garage HQ membership:", error);
    res.status(500).json({ error: "Failed to check membership status" });
  }
});

// Get a single ticket by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { id } = req.params;
    const orgId = req.query.orgId as string;

    // Global admin can view any ticket without orgId
    const isGlobalAdmin = await isGarageHQMember(me.userId);

    let ticket;
    if (isGlobalAdmin && !orgId) {
      // Global admin viewing ticket without org context
      ticket = await SupportTicket.findById(id)
        .populate("createdBy", "name email profilePicture")
        .populate("responses.respondedBy", "name email profilePicture")
        .lean();
    } else {
      if (!orgId) return res.status(400).json({ error: "No organization" });

      ticket = await SupportTicket.findOne({
        _id: id,
        orgId: new Types.ObjectId(orgId),
      })
        .populate("createdBy", "name email profilePicture")
        .populate("responses.respondedBy", "name email profilePicture")
        .lean();
    }

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // Check if user is authorized to view (creator, founder, or global admin)
    const isCreator = ticket.createdBy._id.toString() === me.userId;
    const isFounder = orgId ? await isFounderOfOrg(me.userId, orgId) : false;

    if (!isCreator && !isFounder && !isGlobalAdmin) {
      return res.status(403).json({ error: "Not authorized to view this ticket" });
    }

    // Add org name for global admin
    if (isGlobalAdmin) {
      const org = await Organization.findById(ticket.orgId).select("name").lean();
      (ticket as any).orgName = org?.name || "Unknown Organization";
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

// Update ticket status (founders or global admin)
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { id } = req.params;
    const orgId = req.query.orgId as string;

    const isGlobalAdmin = await isGarageHQMember(me.userId);

    // Global admin doesn't need orgId
    if (!isGlobalAdmin && !orgId) {
      return res.status(400).json({ error: "No organization" });
    }

    // Check if user is founder or global admin
    const isFounder = orgId ? await isFounderOfOrg(me.userId, orgId) : false;
    if (!isFounder && !isGlobalAdmin) {
      return res.status(403).json({ error: "Only founders can update ticket status" });
    }

    const body = z
      .object({
        status: z.enum(["open", "in_progress", "resolved", "closed"]),
      })
      .parse(req.body);

    let ticket;
    if (isGlobalAdmin && !orgId) {
      ticket = await SupportTicket.findByIdAndUpdate(
        id,
        { $set: { status: body.status } },
        { new: true }
      )
        .populate("createdBy", "name email profilePicture")
        .populate("responses.respondedBy", "name email profilePicture")
        .lean();
    } else {
      ticket = await SupportTicket.findOneAndUpdate(
        {
          _id: id,
          orgId: new Types.ObjectId(orgId),
        },
        { $set: { status: body.status } },
        { new: true }
      )
        .populate("createdBy", "name email profilePicture")
        .populate("responses.respondedBy", "name email profilePicture")
        .lean();
    }

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // Emit socket event for status change
    const io = getSocketInstance();
    if (io && ticket) {
      const ticketOrgId = ticket.orgId.toString();
      // Notify the ticket creator
      io.to(`user:${ticket.createdBy._id}`).emit("support:ticket-status-changed", {
        ticketId: ticket._id,
        status: body.status,
        ticket,
      });
      // Notify org room
      io.to(`support:org:${ticketOrgId}`).emit("support:ticket-status-changed", {
        ticketId: ticket._id,
        status: body.status,
        ticket,
      });
      // Notify ticket room (anyone viewing this ticket)
      io.to(`support:ticket:${id}`).emit("support:ticket-status-changed", {
        ticketId: ticket._id,
        status: body.status,
        ticket,
      });
      // Notify global admins
      io.to("support:global").emit("support:ticket-status-changed", {
        ticketId: ticket._id,
        status: body.status,
        ticket,
      });
      console.log(`[SUPPORT] Emitted ticket-status-changed for ticket ${id}`);
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Error updating ticket status:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

// Add a response to a ticket
router.post("/:id/response", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { id } = req.params;
    const orgId = req.query.orgId as string;

    const isGlobalAdmin = await isGarageHQMember(me.userId);

    // Global admin doesn't need orgId
    if (!isGlobalAdmin && !orgId) {
      return res.status(400).json({ error: "No organization" });
    }

    const body = z
      .object({
        message: z.string().min(1).max(5000),
        attachments: z.array(z.string()).optional().default([]),
      })
      .parse(req.body);

    // Find the ticket first to check authorization
    let existingTicket;
    if (isGlobalAdmin && !orgId) {
      existingTicket = await SupportTicket.findById(id).lean();
    } else {
      existingTicket = await SupportTicket.findOne({
        _id: id,
        orgId: new Types.ObjectId(orgId),
      }).lean();
    }

    if (!existingTicket) return res.status(404).json({ error: "Ticket not found" });

    // Check if user is authorized (creator, founder, or global admin)
    const isCreator = existingTicket.createdBy.toString() === me.userId;
    const isFounder = orgId ? await isFounderOfOrg(me.userId, orgId) : false;

    if (!isCreator && !isFounder && !isGlobalAdmin) {
      return res.status(403).json({ error: "Not authorized to respond to this ticket" });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      {
        $push: {
          responses: {
            respondedBy: new Types.ObjectId(me.userId),
            message: body.message,
            attachments: body.attachments,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    )
      .populate("createdBy", "name email profilePicture")
      .populate("responses.respondedBy", "name email profilePicture")
      .lean();

    // Emit socket event for new response
    const io = getSocketInstance();
    if (io && ticket) {
      const ticketOrgId = ticket.orgId.toString();
      const newResponse = ticket.responses[ticket.responses.length - 1];

      // Notify ticket room (anyone viewing this ticket) - primary for real-time chat
      io.to(`support:ticket:${id}`).emit("support:ticket-response", {
        ticketId: ticket._id,
        response: newResponse,
        ticket,
      });
      // Notify the ticket creator if they're not in the ticket room
      io.to(`user:${ticket.createdBy._id}`).emit("support:ticket-response", {
        ticketId: ticket._id,
        response: newResponse,
        ticket,
      });
      // Notify org room for founders
      io.to(`support:org:${ticketOrgId}`).emit("support:ticket-response", {
        ticketId: ticket._id,
        response: newResponse,
        ticket,
      });
      // Notify global admins
      io.to("support:global").emit("support:ticket-response", {
        ticketId: ticket._id,
        response: newResponse,
        ticket,
      });
      console.log(`[SUPPORT] Emitted ticket-response for ticket ${id}`);
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Error adding response:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: "Failed to add response" });
  }
});

// Delete a ticket (creator or founder only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { id } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) return res.status(400).json({ error: "No organization" });

    // Find the ticket first to check authorization
    const existingTicket = await SupportTicket.findOne({
      _id: id,
      orgId: new Types.ObjectId(orgId),
    }).lean();

    if (!existingTicket) return res.status(404).json({ error: "Ticket not found" });

    // Check if user is authorized (creator or founder)
    const isCreator = existingTicket.createdBy.toString() === me.userId;
    const isFounder = await isFounderOfOrg(me.userId, orgId);

    if (!isCreator && !isFounder) {
      return res.status(403).json({ error: "Not authorized to delete this ticket" });
    }

    await SupportTicket.deleteOne({ _id: id });

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

// Get Garage HQ team members for assignment (global admin only)
router.get("/assignment/team-members", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    // Only Garage HQ members can access
    const isGarageHQ = await isGarageHQMember(me.userId);
    if (!isGarageHQ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const garageHQOrgId = new Types.ObjectId(GARAGE_HQ_ORG_ID);

    // Get all team members of Garage HQ
    const teamMembers = await User.find({
      "organizations.organization": garageHQOrgId,
    })
      .select("name email profilePicture organizations")
      .lean();

    // Map to include floor info
    const membersWithFloor = teamMembers.map((member: any) => {
      const orgMembership = member.organizations?.find(
        (org: any) => org.organization?.toString() === GARAGE_HQ_ORG_ID
      );
      return {
        _id: member._id,
        name: member.name,
        email: member.email,
        profilePicture: member.profilePicture,
        role: orgMembership?.role,
        floorId: orgMembership?.floorId,
      };
    });

    res.json({ teamMembers: membersWithFloor });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

// Get Garage HQ floors for assignment (Garage HQ members only)
router.get("/assignment/floors", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    // Only Garage HQ members can access
    const isGarageHQ = await isGarageHQMember(me.userId);
    if (!isGarageHQ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const garageHQOrgId = new Types.ObjectId(GARAGE_HQ_ORG_ID);

    // Get all floors of Garage HQ
    const floors = await Floor.find({ orgId: garageHQOrgId })
      .select("name level departments")
      .sort({ level: 1 })
      .lean();

    // For each floor, get the member count
    const floorsWithCount = await Promise.all(
      floors.map(async (floor: any) => {
        const memberCount = await User.countDocuments({
          "organizations.organization": garageHQOrgId,
          "organizations.floorId": floor._id,
        });
        return {
          ...floor,
          memberCount,
        };
      })
    );

    res.json({ floors: floorsWithCount });
  } catch (error) {
    console.error("Error fetching floors:", error);
    res.status(500).json({ error: "Failed to fetch floors" });
  }
});

// Assign a ticket to a user or floor (global admin only)
router.patch("/:id/assign", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { id } = req.params;

    // Only global admin can assign
    const isGlobalAdmin = await isGarageHQMember(me.userId);
    if (!isGlobalAdmin) {
      return res.status(403).json({ error: "Only global admin can assign tickets" });
    }

    const body = z
      .object({
        assignedTo: z.string().optional(), // User ID
        assignedToFloor: z.string().optional(), // Floor ID
      })
      .refine((data) => data.assignedTo || data.assignedToFloor, {
        message: "Must assign to either a user or a floor",
      })
      .refine((data) => !(data.assignedTo && data.assignedToFloor), {
        message: "Cannot assign to both a user and a floor",
      })
      .parse(req.body);

    const updateData: any = {
      assignedAt: new Date(),
      assignedBy: new Types.ObjectId(me.userId),
    };

    if (body.assignedTo) {
      updateData.assignedTo = new Types.ObjectId(body.assignedTo);
      updateData.assignedToFloor = null; // Clear floor assignment
    } else if (body.assignedToFloor) {
      updateData.assignedToFloor = new Types.ObjectId(body.assignedToFloor);
      updateData.assignedTo = null; // Clear user assignment
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
      .populate("createdBy", "name email profilePicture")
      .populate("responses.respondedBy", "name email profilePicture")
      .populate("assignedTo", "name email profilePicture")
      .populate("assignedToFloor", "name level")
      .populate("assignedBy", "name email")
      .lean();

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // Add org name
    const org = await Organization.findById(ticket.orgId).select("name").lean();
    (ticket as any).orgName = org?.name || "Unknown Organization";

    // Emit socket event for assignment
    const io = getSocketInstance();
    if (io && ticket) {
      const ticketOrgId = ticket.orgId.toString();
      // Notify ticket room
      io.to(`support:ticket:${id}`).emit("support:ticket-assigned", {
        ticketId: ticket._id,
        assignedTo: ticket.assignedTo,
        assignedToFloor: ticket.assignedToFloor,
        ticket,
      });
      // Notify the assigned user if assigned to a person
      if (body.assignedTo) {
        io.to(`user:${body.assignedTo}`).emit("support:ticket-assigned", {
          ticketId: ticket._id,
          assignedTo: ticket.assignedTo,
          ticket,
        });
      }
      // Notify org room
      io.to(`support:org:${ticketOrgId}`).emit("support:ticket-assigned", {
        ticketId: ticket._id,
        assignedTo: ticket.assignedTo,
        assignedToFloor: ticket.assignedToFloor,
        ticket,
      });
      // Notify global admins
      io.to("support:global").emit("support:ticket-assigned", {
        ticketId: ticket._id,
        assignedTo: ticket.assignedTo,
        assignedToFloor: ticket.assignedToFloor,
        ticket,
      });
      console.log(`[SUPPORT] Emitted ticket-assigned for ticket ${id}`);
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Error assigning ticket:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: "Failed to assign ticket" });
  }
});

// Unassign a ticket (global admin only)
router.patch("/:id/unassign", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { id } = req.params;

    // Only global admin can unassign
    const isGlobalAdmin = await isGarageHQMember(me.userId);
    if (!isGlobalAdmin) {
      return res.status(403).json({ error: "Only global admin can unassign tickets" });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      {
        $unset: {
          assignedTo: 1,
          assignedToFloor: 1,
          assignedAt: 1,
          assignedBy: 1,
        },
      },
      { new: true }
    )
      .populate("createdBy", "name email profilePicture")
      .populate("responses.respondedBy", "name email profilePicture")
      .lean();

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // Add org name
    const org = await Organization.findById(ticket.orgId).select("name").lean();
    (ticket as any).orgName = org?.name || "Unknown Organization";

    // Emit socket event for unassignment
    const io = getSocketInstance();
    if (io && ticket) {
      const ticketOrgId = ticket.orgId.toString();
      // Notify ticket room
      io.to(`support:ticket:${id}`).emit("support:ticket-unassigned", {
        ticketId: ticket._id,
        ticket,
      });
      // Notify org room
      io.to(`support:org:${ticketOrgId}`).emit("support:ticket-unassigned", {
        ticketId: ticket._id,
        ticket,
      });
      // Notify global admins
      io.to("support:global").emit("support:ticket-unassigned", {
        ticketId: ticket._id,
        ticket,
      });
      console.log(`[SUPPORT] Emitted ticket-unassigned for ticket ${id}`);
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Error unassigning ticket:", error);
    res.status(500).json({ error: "Failed to unassign ticket" });
  }
});

export default router;
