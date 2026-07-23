import type { Application, RequestHandler } from "express";
import prisma from "../prisma.js";
import type {
  TenantAccountSummary,
  UpdateTenantAccountRequest,
  UpdateTenantSettingsRequest,
} from "@football/shared";

const getTenantSettings: RequestHandler = async (req, res) => {
  const tenantId = Number(req.params.tenantId);

  if (!tenantId) {
    return res.status(400).json({ message: "Tenant ID is required." });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        settings: true,
        tenant_accounts: {
          where: {
            OR: [{ requiresApproval: true }, { blacklisted: true }],
          },
          select: {
            accountId: true,
            requiresApproval: true,
            blacklisted: true,
            account: { select: { name: true } },
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found." });
    }

    const flaggedAccounts: TenantAccountSummary[] = tenant.tenant_accounts.map(
      (ta) => ({
        accountId: ta.accountId,
        name: ta.account.name,
        requiresApproval: ta.requiresApproval,
        blacklisted: ta.blacklisted,
      })
    );

    return res.status(200).json({
      id: tenant.id,
      name: tenant.name,
      settings: tenant.settings,
      flaggedAccounts,
    });
  } catch (error) {
    console.error("Error fetching tenant settings:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const updateTenantSettings: RequestHandler = async (req, res) => {
  const { tenantId, settings } = req.body as UpdateTenantSettingsRequest;

  if (!tenantId || !settings) {
    return res
      .status(400)
      .json({ message: "Tenant ID and settings are required." });
  }

  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings },
    });

    return res
      .status(200)
      .json({ message: "Tenant settings updated successfully." });
  } catch (error) {
    console.error("Error updating tenant settings:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const updateTenantAccount: RequestHandler = async (req, res) => {
  const { tenantId, accountId, requiresApproval, blacklisted } =
    req.body as UpdateTenantAccountRequest;

  if (!tenantId || !accountId) {
    return res
      .status(400)
      .json({ message: "Tenant ID and account ID are required." });
  }

  try {
    const existing = await prisma.tenantAccount.findUnique({
      where: { tenantId_accountId: { tenantId, accountId } },
      select: { requiresApproval: true, blacklisted: true },
    });

    const nextRequiresApproval =
      requiresApproval ?? existing?.requiresApproval ?? false;
    const nextBlacklisted = blacklisted ?? existing?.blacklisted ?? false;

    // A row with no flags carries no information — delete instead of keeping it.
    if (!nextRequiresApproval && !nextBlacklisted) {
      if (existing) {
        await prisma.tenantAccount.delete({
          where: { tenantId_accountId: { tenantId, accountId } },
        });
      }
      return res.status(200).json({ message: "Account flags cleared." });
    }

    await prisma.tenantAccount.upsert({
      where: { tenantId_accountId: { tenantId, accountId } },
      create: {
        tenantId,
        accountId,
        requiresApproval: nextRequiresApproval,
        blacklisted: nextBlacklisted,
      },
      update: {
        requiresApproval: nextRequiresApproval,
        blacklisted: nextBlacklisted,
      },
    });

    return res.status(200).json({ message: "Account flags updated." });
  } catch (error) {
    console.error("Error updating tenant account:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const registerTenantRoutes = (app: Application) => {
  app.get("/tenants/:tenantId", getTenantSettings);
  app.post("/tenants", updateTenantSettings);
  app.post("/tenants/accounts", updateTenantAccount);
};
