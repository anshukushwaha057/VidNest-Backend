import { v2 as cloudinary } from "cloudinary";
import fs from "fs"


// Configuration of cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
});

const uploadOncloudinary = async (localfilePath) => {
    try {
        if (!localfilePath) return null;
        const response = await cloudinary.uploader.upload(localfilePath, {
            resource_type: 'auto'
        })
        // console.log("file is uploaded on cloudinary", response.url)
        fs.unlinkSync(localfilePath)
        return response;

    } catch (error) {
        fs.unlinkSync(localfilePath) // ager upload nhi hua to cloudinary pe crupted file ko clean krne ke liy
        // remove the locally saved temporary file as the upload operation got failed
        return null
    }
}
 
export {uploadOncloudinary}

