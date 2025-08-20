import express from 'express';

import {  deleteProfile, getAllProfile, getFullProfile, getProfile, updateProfile, updateUserDetails } from '../controllers/userController';
import { verifyToken } from '../middlewares/verifyToken';


const router = express.Router();

router.get('/profile', verifyToken, getProfile); //return jwt token
router.get('/profiles', verifyToken, getAllProfile); //return all users
router.get('/me', verifyToken, getFullProfile); //return full user profile
router.put('/profile', verifyToken, updateProfile);
router.put('/details', verifyToken, updateUserDetails);
router.delete('/profile', verifyToken, deleteProfile);

//router.delete('/delete-all', verifyToken, deleteAllUsers);

export default router;
