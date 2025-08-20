import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import prisma from '../config/prisma';
import { generateToken } from '../utils/jwt';

// To know who is the user from the token 
export const getProfile = (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user;
  res.json({ user });
};

export const getAllProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users' });
  }
};

export const getFullProfile = async (req: Request, res: Response): Promise<void> => {
  // @ts-ignore
  const user = req.user;

  try {
    const fullUser = await userService.getFullUserProfile(user.id);
    res.status(200).json(fullUser);
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
};


export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  // @ts-ignore
  const user = req.user;
  const { email, phone } = req.body;

  try {
    const updatedUser = await userService.updateUserProfile(user.id, email, phone, user.countryCode);
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: msg });
  }
};

export const deleteProfile = async (req: Request, res: Response): Promise<void> => {
  // @ts-ignore
  const user = req.user;

  try {
    const deletedUser = await userService.deleteUserById(user.id);
    res.status(200).json({
      message: 'Profile deleted successfully',
      user: {
        id: deletedUser.id,
        email: deletedUser.email,
        phone: deletedUser.phone,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting profile' });
  }
};

/*export const deleteAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.otpCode.deleteMany();
    await prisma.user.deleteMany();

    res.status(200).json({ message: 'All users deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting all users' });
  }
};*/



export const updateUserDetails = async (req: Request, res: Response): Promise<void> => {
  // @ts-ignore
  const user = req.user;
  const updatedData = req.body;

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
      },
    });

   
    if (!existingUser && !user.isNewUser) {
     res.status(403).json({
        error: 'Registration is only allowed through the proper flow.',
      });
    }

    const updatedUser = await userService.updateUserDetails(
      {
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
      },
      updatedData
    );

    const token = generateToken(updatedUser);
    res.status(200).json({
      message: 'User details saved successfully',
      token,
      user: updatedUser,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: msg });
  }
};


