import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOncloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshtokens = async (userID) => {

    try {
        const user = await User.findById(userID)
        if (!user) {
            throw new ApiError(404, "User not found");
        }
        // console.log(user)
        // console.log(user instanceof User);

        // if (typeof user.generateRefreshToken === "function") {
        //     console.log("✅ generateAccessToken exists!");
        // } else {
        //     console.log("❌ Method does not exist!");
        // }       

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken //updating refresh token in db
        await user.save({ validateBeforeSave: false }) // saving without password
        // console.log("\n accessToken --", accessToken,"\n refreshToken--", refreshToken)
        return { accessToken, refreshToken }

    } catch (error) {
        // console.error("omething went wrong while generating Access and Refresh Token")
        throw new ApiError(501, "Something went wrong while generating Access and Refresh Token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // 1. Get user details from frontend
    const { username, email, fullName, password } = req.body;

    // 2. Validation - check if fields are not empty
    if ([username, email, fullName, password].some(field => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // 3. Check if user already exists
    const existUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    // 4. Check for images (Safe way to handle Multer files)
    let avatarLocalPath;
    if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path;
    }

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    // 5. Validation - Avatar is mandatory
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // 6. Upload on Cloudinary
    const avatar = await uploadOncloudinary(avatarLocalPath);
    const coverImage = await uploadOncloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Error while uploading avatar on Cloudinary");
    }

    // 7. Create user object and entry in DB
    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "", // optional
        password,
    });

    // 8. Remove password and refresh token from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500,
             "Something went wrong while registering the user");
    }

    // 9. Send success response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );
});

const loginUser = asyncHandler(async (req, res) => {

    const { username, email, password } = req.body
    

    if (!(username || email)) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        throw new ApiError(404, "user not found")
    }

    // console.log(user)
    // console.log(user._id)

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "invalid User Credential")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshtokens(user._id)
    // console.log(accessToken, refreshToken)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    // console.log("Logged in user ",loggedInUser)

    // cookies // its can modify from only server 
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200, {
                // user: loggedInUser, accessToken, refreshToken,
                user: loggedInUser, accessToken, refreshToken, success: true,
            },
                "User LoggedIn Successfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user_id,
        {
            $unset: {
                refreshToken: 1, // this remove the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, { success: true }, "User Logged Out")
        )
})

const renewAccessToken = asyncHandler(async (req, res) => {

    // const date = new Date().toLocaleTimeString()
    // console.log(`Header By postman ${date}`,req.cookies.refreshToken)

    const incomingRefereshToken = req.cookies.refreshToken

    // console.log("incoming ",incomingRefereshToken)

    if (!incomingRefereshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedRefreshToken = jwt.verify(incomingRefereshToken, process.env.REFRESH_TOKEN_SECRET)

        console.log("decode value +++++++++++", decodedRefreshToken)

        const user = await User.findById(decodedRefreshToken._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
        // console.log("user ++++++++++++++++",user)

        // console.log("",incomingRefereshToken)

        // console.log("from database token ",user)

        if (incomingRefereshToken != user.refreshToken) {
            throw new ApiError(401, "Refesh token is Expired or used")
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshtokens(user._id)

        const options = {
            httpOnly: true,
            secure: true
        }

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken, success: true },
                    "access Token refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh Token")
    }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {

    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invailid old Password")
    }

    console.log(user.password)

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.status(200)
        .json(
            new ApiResponse(201, {}, "password changed successfully")
        )

})

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = req.user
    if (!user) {
        throw new ApiError(401, "Unauthorized access") // Global error middleware handle karega
    }

    res.status(200).json(
        new ApiResponse(200, { user: user, success: true }, "Current user fetched successfully")
    );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!fullName && !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            fullName,
            email
        }

    },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
        .json(
            new ApiResponse(200, user, "Datails Update Successfully")
        )

})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar File Is Missing")
    }

    // TODO- delete old image on cloudinary
    const avatar = await uploadOncloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "error while uploading avatar on cloud")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200)
        .json(
            new ApiResponse(200, user, "avatar updated successfully")
        )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image File Is Missing")
    }

    const coverImage = await uploadOncloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "error while uploading avatar on cloud")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200)
        .json(
            new ApiResponse(200, user, "avatar updated successfully")
        )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size:"$subscribers"
                },
                subscribedTo:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in: [req.user?._id, "$subscriptions.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    console.log(channel)
    if(!channel.length){
        throw new ApiError(404, "user channel not exists")
    }

    res.status(200)
    .json(
        new ApiResponse(200, channel[0], "user channel fetched successfully")
    )


})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    fullName: 1,
                                    username: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    }
                ]
            },
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        }
    ])

    res.status(200)
        .json(
            new ApiResponse(200, user.watchHistory, "watch history fetch succesfully")
        )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    renewAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,

}