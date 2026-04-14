import { Router } from "express";
import{
    toggleSubscription,
    getSubscribedChannels,
    getUserChannelSubscribers,

} from "../controllers/subscription.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/c/:channelId").post(verifyJWT,toggleSubscription);
router.route("/c/:subscriberId").get(verifyJWT,getSubscribedChannels); // jo tum subscribed kiye ho


router.route("/u/:channelId").get(verifyJWT,getUserChannelSubscribers); // jo tumhare subscriber hai

export default router;