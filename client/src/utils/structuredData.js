export const createJobPostingSchema = (job, client) => ({
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": job.title,
  "description": job.description,
  "datePosted": job.createdAt,
  "validThrough": job.expiresAt,
  "employmentType": job.jobType?.toUpperCase() || "CONTRACTOR",
  "hiringOrganization": {
    "@type": "Organization",
    "name": client ? `${client.firstName} ${client.lastName}` : "FetchWork Client",
    "url": "https://fetchwork.net"
  },
  "jobLocation": job.isRemote ? {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Remote"
    }
  } : {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": job.location
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": job.budget?.currency || "USD",
    "value": {
      "@type": "QuantitativeValue",
      "value": job.budget?.amount,
      "unitText": job.budget?.type === "hourly" ? "HOUR" : "TOTAL"
    }
  },
  "skills": job.skills,
  "experienceRequirements": job.experienceLevel,
  "url": `${window.location.origin}/jobs/${job._id}`
});

export const createPersonSchema = (user) => ({
  "@context": "https://schema.org",
  "@type": "Person",
  "name": `${user.firstName} ${user.lastName}`,
  "description": user.bio,
  "image": user.profilePicture,
  "url": `${window.location.origin}/freelancer/${user.username || user._id}`,
  "jobTitle": user.skills?.[0] || "Freelancer",
  "worksFor": {
    "@type": "Organization",
    "name": "FetchWork"
  },
  "address": user.location ? {
    "@type": "PostalAddress",
    "addressLocality": user.location
  } : undefined,
  "sameAs": [
    user.socialLinks?.linkedin,
    user.socialLinks?.github,
    user.socialLinks?.portfolio,
    user.socialLinks?.twitter
  ].filter(Boolean)
});

export const createOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "FetchWork",
  "description": "Professional freelance marketplace connecting clients with skilled freelancers",
  "url": "https://fetchwork.net",
  "logo": `${window.location.origin}/logo512.png`,
  "sameAs": [
    "https://twitter.com/fetchwork",
    "https://linkedin.com/company/fetchwork"
  ]
});

export const createWebsiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "FetchWork",
  "description": "Professional freelance marketplace",
  "url": "https://fetchwork.net",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://fetchwork.net/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
});
