import { Router } from "express";
import { z } from "zod";
import { validate } from "../utils/validate";
import { authenticatePortalLogin } from "../services/portal-login";

const router = Router({ mergeParams: true });

router.post(
  "/",
  validate({ body: z.object({ email: z.string().email(), password: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const result = await authenticatePortalLogin(tenant, req.body.email, req.body.password);
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("portal_session_token", result.session.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ success: true, account: result.account });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
