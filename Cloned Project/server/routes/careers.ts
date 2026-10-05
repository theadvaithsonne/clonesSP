import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { Vacancy } from "../models/vacancy.model";
import { Application } from "../models/application.model";

const router = Router();

// ==========================================
// VACANCIES
// ==========================================

// GET /careers/vacancies - List all open vacancies (public)
router.get("/vacancies", async (req, res) => {
  try {
    const { orgId } = req.query;
    const filter: any = { status: "open" };
    if (orgId) filter.orgId = orgId;

    const vacancies = await Vacancy.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ vacancies });
  } catch (error) {
    console.error("Error fetching vacancies:", error);
    res.status(500).json({ error: "Failed to fetch vacancies" });
  }
});

// GET /careers/vacancies/:id - Single vacancy detail (public)
router.get("/vacancies/:id", async (req, res) => {
  try {
    const vacancy = await Vacancy.findById(req.params.id).lean();
    if (!vacancy) return res.status(404).json({ error: "Vacancy not found" });
    res.json({ vacancy });
  } catch (error) {
    console.error("Error fetching vacancy:", error);
    res.status(500).json({ error: "Failed to fetch vacancy" });
  }
});

// POST /careers/vacancies?orgId=X - Create vacancy (founder)
router.post("/vacancies", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId?: string };
    const orgId = (req.query.orgId as string) || me.orgId;

    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const { title, department, location, employmentType, description, requirements, salary, status } = req.body;

    if (!title || !department || !location || !description) {
      return res.status(400).json({ error: "title, department, location, and description are required" });
    }

    const vacancy = await Vacancy.create({
      orgId,
      title: title.trim(),
      department: department.trim(),
      location: location.trim(),
      employmentType: employmentType || "full-time",
      description,
      requirements: requirements || undefined,
      salary: salary || undefined,
      status: status || "open",
      createdBy: me.userId,
    });

    res.status(201).json({ vacancy });
  } catch (error) {
    console.error("Error creating vacancy:", error);
    res.status(500).json({ error: "Failed to create vacancy" });
  }
});

// PATCH /careers/vacancies/:id?orgId=X - Update vacancy (founder)
router.patch("/vacancies/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const vacancy = await Vacancy.findOneAndUpdate(
      { _id: req.params.id, orgId },
      { $set: req.body },
      { new: true }
    ).lean();

    if (!vacancy) return res.status(404).json({ error: "Vacancy not found" });

    res.json({ vacancy });
  } catch (error) {
    console.error("Error updating vacancy:", error);
    res.status(500).json({ error: "Failed to update vacancy" });
  }
});

// DELETE /careers/vacancies/:id?orgId=X - Delete vacancy (founder)
router.delete("/vacancies/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const result = await Vacancy.findOneAndDelete({ _id: req.params.id, orgId });
    if (!result) return res.status(404).json({ error: "Vacancy not found" });

    res.json({ message: "Vacancy deleted successfully" });
  } catch (error) {
    console.error("Error deleting vacancy:", error);
    res.status(500).json({ error: "Failed to delete vacancy" });
  }
});

// ==========================================
// APPLICATIONS
// ==========================================

// POST /careers/applications - Submit application (public)
router.post("/applications", async (req, res) => {
  try {
    const { vacancyId, applicantName, applicantEmail, applicantPhone, resumeUrl, coverLetter } = req.body;

    if (!vacancyId || !applicantName || !applicantEmail) {
      return res.status(400).json({ error: "vacancyId, applicantName, and applicantEmail are required" });
    }

    const vacancy = await Vacancy.findById(vacancyId).lean();
    if (!vacancy) return res.status(404).json({ error: "Vacancy not found" });

    const application = await Application.create({
      vacancyId,
      vacancyTitle: vacancy.title,
      orgId: vacancy.orgId,
      applicantName: applicantName.trim(),
      applicantEmail: applicantEmail.trim(),
      applicantPhone: applicantPhone?.trim() || undefined,
      resumeUrl: resumeUrl || undefined,
      coverLetter: coverLetter?.trim() || undefined,
      status: "pending",
    });

    res.status(201).json({ application });
  } catch (error) {
    console.error("Error submitting application:", error);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

// GET /careers/applications?orgId=X - List applications (founder)
router.get("/applications", requireAuth, async (req, res) => {
  try {
    const { orgId, vacancyId, status } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const filter: any = { orgId };
    if (vacancyId) filter.vacancyId = vacancyId;
    if (status) filter.status = status;

    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ applications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// PATCH /careers/applications/:id?orgId=X - Update application status (founder)
router.patch("/applications/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });

    const validStatuses = ["pending", "reviewed", "shortlisted", "rejected", "hired"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, orgId },
      { $set: { status } },
      { new: true }
    ).lean();

    if (!application) return res.status(404).json({ error: "Application not found" });

    res.json({ application });
  } catch (error) {
    console.error("Error updating application status:", error);
    res.status(500).json({ error: "Failed to update application status" });
  }
});

export default router;
