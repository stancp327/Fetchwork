import React from 'react';

const Pagination = ({ pagination, onPageChange }) => {
  if (pagination.pages <= 1) return null;

  return (
    <div className="pagination">
      <button
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={pagination.page === 1}
      >
        Previous
      </button>
      
      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
        const page = i + 1;
        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={pagination.page === page ? 'active' : ''}
          >
            {page}
          </button>
        );
      })}
      
      <button
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={pagination.page === pagination.pages}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
