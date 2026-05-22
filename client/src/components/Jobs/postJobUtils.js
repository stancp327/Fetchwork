export const validateStep = (step, formData) => {
  const errors = {};
  switch (step) {
    case 1:
      if (!formData.title.trim()) errors.title = 'Job title is required';
      else if (formData.title.length > 100) errors.title = 'Title cannot exceed 100 characters';
      if (!formData.description.trim()) errors.description = 'Job description is required';
      else if (formData.description.length > 5000) errors.description = 'Description cannot exceed 5000 characters';
      if (!formData.category) errors.category = 'Category is required';
      break;
    case 2:
      if (!formData.experienceLevel) errors.experienceLevel = 'Experience level is required';
      if (!formData.duration) errors.duration = 'Duration is required';
      break;
    case 3:
      if (!formData.budgetAmount || parseFloat(formData.budgetAmount) < 1) errors.budgetAmount = 'Budget must be at least $1';
      if (formData.budgetType === 'range') {
        if (!formData.budgetMax || parseFloat(formData.budgetMax) < 1) errors.budgetMax = 'Max budget is required for range pricing';
        else if (parseFloat(formData.budgetMax) <= parseFloat(formData.budgetAmount)) errors.budgetMax = 'Max budget must be greater than min budget';
      }
      break;
    default:
      break;
  }
  return errors;
};

export const validateFormData = (formData) => {
  const errors = {};

  if (!formData.title.trim()) {
    errors.title = 'Job title is required';
  } else if (formData.title.length > 100) {
    errors.title = 'Title cannot exceed 100 characters';
  }

  if (!formData.description.trim()) {
    errors.description = 'Job description is required';
  } else if (formData.description.length > 5000) {
    errors.description = 'Description cannot exceed 5000 characters';
  }

  if (!formData.category) {
    errors.category = 'Category is required';
  }

  if (!formData.budgetAmount || parseFloat(formData.budgetAmount) < 1) {
    errors.budgetAmount = 'Budget must be at least $1';
  }

  if (formData.budgetType === 'range') {
    if (!formData.budgetMax || parseFloat(formData.budgetMax) < 1) {
      errors.budgetMax = 'Max budget is required for range pricing';
    } else if (parseFloat(formData.budgetMax) <= parseFloat(formData.budgetAmount)) {
      errors.budgetMax = 'Max budget must be greater than min budget';
    }
  }

  if (!formData.duration) {
    errors.duration = 'Duration is required';
  }

  if (!formData.experienceLevel) {
    errors.experienceLevel = 'Experience level is required';
  }

  return errors;
};

export const buildJobPayload = (formData, selectedTeam) => {
  const skillsArray = formData.skills
    .split(',')
    .map(skill => skill.trim())
    .filter(skill => skill.length > 0);

  const payload = {
    title: formData.title.trim(),
    description: formData.description.trim(),
    category: formData.category,
    subcategory: formData.subcategory.trim() || undefined,
    skills: skillsArray,
    budget: {
      type: formData.budgetType,
      amount: parseFloat(formData.budgetAmount),
      maxAmount: formData.budgetType === 'range' && formData.budgetMax ? parseFloat(formData.budgetMax) : undefined,
      currency: formData.currency,
    },
    duration: formData.duration,
    experienceLevel: formData.experienceLevel,
    projectType: formData.projectType || 'one_time',
    location: {
      locationType: formData.locationType,
      city: formData.city.trim(),
      state: formData.state.trim(),
      zipCode: formData.zipCode.trim(),
      address: formData.city && formData.state ? `${formData.city.trim()}, ${formData.state.trim()}` : '',
      coordinates: { type: 'Point', coordinates: [0, 0] },
      serviceRadius: 25,
    },
    deadline: formData.deadline || null,
    scheduledDate: formData.scheduledDate || null,
    isUrgent: formData.isUrgent,
    recurring: formData.recurringEnabled
      ? {
          enabled: true,
          interval: formData.recurringInterval,
          endDate: formData.recurringEndDate || null,
          nextRunDate: null,
        }
      : { enabled: false },
  };

  if (selectedTeam) payload.teamId = selectedTeam;

  // Include uploaded attachments
  if (formData.attachments && formData.attachments.length > 0) {
    payload.attachments = formData.attachments.map(({ filename, url, size, contentType }) => ({
      filename, url, size, contentType,
    }));
  }

  return payload;
};
