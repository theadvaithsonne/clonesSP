import { Router } from "express";
import branchesRouter from "./branches";
import departmentsRouter from "./departments";
import shiftsRouter from "./shifts";
import weeklyOffPatternsRouter from "./weeklyOffPatterns";
import employeesRouter from "./employees";
import leaveRequestsRouter from "./leaveRequests";
import leavePoliciesRouter from "./leavePolicies";
import breakSettingsRouter from "./breakSettings";
import salaryStructuresRouter from "./salaryStructures";
import payrollConfigRouter from "./payrollConfig";
import ptSlabsRouter from "./ptSlabs";
import taxDeclarationRouter from "./taxDeclaration";
import payrollRunsRouter from "./payrollRuns";
import recruitmentRequestsRouter from "./recruitmentRequests";
import candidatesRouter from "./candidates";

const router = Router();

router.use("/branches", branchesRouter);
router.use("/departments", departmentsRouter);
router.use("/shifts", shiftsRouter);
router.use("/weekly-off-patterns", weeklyOffPatternsRouter);
router.use("/employees", employeesRouter);
router.use("/leave-requests", leaveRequestsRouter);
router.use("/leave-policies", leavePoliciesRouter);
router.use("/break-settings", breakSettingsRouter);
router.use("/salary-structures", salaryStructuresRouter);
router.use("/payroll-config", payrollConfigRouter);
router.use("/pt-slabs", ptSlabsRouter);
router.use("/tax-declaration", taxDeclarationRouter);
router.use("/payroll-runs", payrollRunsRouter);
router.use("/recruitment-requests", recruitmentRequestsRouter);
router.use("/candidates", candidatesRouter);

export default router;
