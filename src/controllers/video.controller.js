import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOncloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    let { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query

    page = parseInt(page)
    limit = parseInt(limit)

    const filter = { isPublished: true }

    if (query) {
        filter.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    }

    if (userId && isValidObjectId(userId)) {
        filter.owner = userId
    }

    const sortOption = {
        [sortBy]: sortType === "asc" ? 1 : -1
    }

    const videos = await Video.find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)

    const totalVideos = await Video.countDocuments(filter)

    return res.status(200).json(
        new ApiResponse(200, {
            videos,
            totalVideos,
            currentPage: page,
            totalPages: Math.ceil(totalVideos / limit)
        }, "Videos fetched successfully")
    )
})


const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body

    if (!title || !description) {
        throw new ApiError(400, "title and description required")
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if (!videoLocalPath) {
        throw new ApiError(400, "video file is required")
    }

    const videoUpload = await uploadOncloudinary(videoLocalPath)

    if (!videoUpload) {
        throw new ApiError(500, "video upload failed")
    }

    let thumbnailUrl = ""

    if (thumbnailLocalPath) {
        const thumbnailUpload = await uploadOncloudinary(thumbnailLocalPath)
        thumbnailUrl = thumbnailUpload?.url || ""
    }

    const video = await Video.create({
        title,
        description,
        videoFile: videoUpload.url,
        thumbnail: thumbnailUrl,
        owner: req.user._id,
        duration: videoUpload.duration || 0,
        isPublished: true
    })

    return res.status(201).json(
        new ApiResponse(201, video, "Video published successfully")
    )
})


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    return res.status(200).json(
        new ApiResponse(200, video, "Video fetched successfully")
    )
})


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized")
    }

    let thumbnailUrl = video.thumbnail

    if (req.file) {
        const uploaded = await uploadOncloudinary(req.file.path)
        if (uploaded) {
            thumbnailUrl = uploaded.url
        }
    }

    video.title = title || video.title
    video.description = description || video.description
    video.thumbnail = thumbnailUrl

    await video.save()

    return res.status(200).json(
        new ApiResponse(200, video, "Video updated successfully")
    )
})


const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized")
    }

    await video.deleteOne()

    return res.status(200).json(
        new ApiResponse(200, {}, "Video deleted successfully")
    )
})


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res.status(200).json(
        new ApiResponse(200, video, "Publish status toggled")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}