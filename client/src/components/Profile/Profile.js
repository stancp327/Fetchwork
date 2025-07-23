import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ReviewDisplay from '../Reviews/ReviewDisplay';
import axios from 'axios';
import './Profile.css';

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://fetchwork-1.onrender.com' 
        : 'http://localhost:10000';
      
      const token = localStorage.getItem('token');
      const profileEndpoint = userId 
        ? `${API_BASE_URL}/api/users/profile/${userId}`
        : `${API_BASE_URL}/api/users/profile`;
      
      const response = await axios.get(profileEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setProfileUser(response.data.user);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  if (!profileUser) {
    return <div className="profile-error">Profile not found</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <img 
          src={profileUser.profilePicture || '/default-avatar.png'} 
          alt={`${profileUser.firstName} ${profileUser.lastName}`}
          className="profile-avatar"
        />
        <div className="profile-info">
          <h1>{profileUser.firstName} {profileUser.lastName}</h1>
          <p className="profile-bio">{profileUser.bio || 'No bio available'}</p>
          <div className="profile-stats">
            <span>Rating: {profileUser.rating ? profileUser.rating.toFixed(1) : '0.0'}/5</span>
            <span>Reviews: {profileUser.totalReviews || 0}</span>
            <span>Jobs Completed: {profileUser.completedJobs || 0}</span>
          </div>
        </div>
      </div>
      
      <ReviewDisplay userId={profileUser._id} />
    </div>
  );
};

export default Profile;
