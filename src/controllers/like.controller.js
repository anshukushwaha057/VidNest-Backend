import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    // 1. Validation: Check karo videoId valid MongoDB ID hai ya nahi
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID")
    }

    // 2. Check: Kya user ne pehle se like kiya hua hai?
    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    })

    if (existingLike) {
        // 3. Agar mil gaya, toh Remove (Unlike)
        await Like.findByIdAndDelete(existingLike._id)
        
        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "Video unliked successfully"))
    }

    // 4. Agar nahi mila, toh Create (Like)
    await Like.create({
        video: videoId,
        likedBy: req.user?._id
    })

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }, "Video liked successfully"))
})


const getLikedVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id

    const likedVideos = await Like.aggregate([
        {
            // 1. Match: Is user ke saare likes dhundo jo 'video' par hain
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                video: { $exists: true, $ne: null }
            }
        },
        {
            // 2. Lookup: Video ki details dusri collection se le kar aao
            $lookup: {
                from: "videos", // Aapke database collection ka naam
                localField: "video",
                foreignField: "_id",
                as: "videoDetails",
                pipeline: [
                    {
                        // 3. Nested Lookup: Video ke owner ki details bhi le lo
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerDetails"
                        }
                    },
                    { $unwind: "$ownerDetails" },
                    {
                        // 4. Project: Sirf wahi fields jo zaroori hain
                        $project: {
                            videoFile: 1,
                            thumbnail: 1,
                            title: 1,
                            duration: 1,
                            views: 1,
                            ownerDetails: {
                                username: 1,
                                avatar: 1
                            }
                        }
                    }
                ]
            }
        },
        { $unwind: "$videoDetails" },
        {
            // 5. Final Output: Data ko clean format mein bhejne ke liye
            $replaceRoot: { newRoot: "$videoDetails" }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(200, likedVideos, "Liked videos fetched successfully"))
})

export {
    toggleVideoLike,
    getLikedVideos
}