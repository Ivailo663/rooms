import type { Application, RequestHandler } from "express";
import prisma from "../prisma.js";
import type { UpdateTenantSettingsRequest } from "@football/shared";

const getTenantSettings: RequestHandler = async (req, res) => {
  const tenantId = Number(req.params.tenantId);

  if (!tenantId) {
    return res.status(400).json({ message: "Tenant ID is required." });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, settings: true },
    });

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found." });
    }

    return res.status(200).json(tenant);
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

export const registerTenantRoutes = (app: Application) => {
  app.get("/tenants/:tenantId", getTenantSettings);
  app.post("/tenants", updateTenantSettings);
};
