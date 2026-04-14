import { asyncHandler } from "../utils/asyncHandler.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import mongoose from "mongoose";

const toggleSubscription = asyncHandler(async (req, res) => {
    const userId = req.user?._id
    const { channelId } = req.params

    if (!(userId && channelId)) {
        throw new ApiError(400, "channelId OR userId is missing")
    }

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid channel ID format");
    }

    const channel = await User.findById(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    const existSubscriber = await Subscription.exists({
        subscriber: userId,
        channel: channelId
    })

    if (existSubscriber) {
        await Subscription.deleteOne({ subscriber: userId, channel: channelId })

        return res.status(200)
            .json(
                new ApiResponse(200, {}, `You Unsubscribe ${channelId} successfully`)
            )
    }

    await Subscription.create({
        subscriber: userId,
        channel: channelId
    })

    return res.status(200)
        .json(
            new ApiResponse(200, {}, `Subscribe ${channelId} successfully`)
        )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req,res)=>{
    const { subscriberId } = req.params

    if(!subscriberId){
        throw new ApiError(400, "channelId is empty")
    }

    const channelList = await Subscription.find({
        subscriber:subscriberId
    })

    if (!channelList || channelList.length === 0) {
        throw new ApiError(404, "No subscribed channels found");
    }

    return res.status(200)
    .json(
        new ApiResponse(200, channelList, "subscribed channel fetched successfully")
    )
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req,res)=>{
    const { channelId } = req.params

    if(!channelId){
        throw new ApiError(400, "channelId is empty")
    }

    const subscriberList = await Subscription.find({
        channel:channelId
    })

    if (!subscriberList || subscriberList.length === 0) {
        throw new ApiError(404, "No subscriber found");
    }

    return res.status(200)
    .json(
        new ApiResponse(200, subscriberList, "subscriber fetched successfully")
    )
})




export { 
    toggleSubscription,
    getSubscribedChannels,
    getUserChannelSubscribers
        
 }