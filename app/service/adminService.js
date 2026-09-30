const API_URL = '/api/students';
const API_URL_TEACHERS = '/api/teachers';
const API_URL_CLASSROOMS = '/api/classrooms';
const API_URL_YEARS = '/api/academic_years';
const API_URL_CLASSROOM_TYPES = '/api/classroom-types';
const API_URL_CAMPS_ADMIN = '/api/camps/admin';
const API_URL_STUDENTS_ADMIN = '/api/students/admin';
const API_URL_TEACHERS_ADMIN = '/api/teachers/admin';
const API_URL_CLASSROOMS_ADMIN = '/api/classrooms/admin';

const getStudents = async (yearId) => {
  try {
    let url = API_URL;
    if (yearId && yearId !== "all") {
        url += `?yearId=${yearId}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Failed to fetch students');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : []; 
  } catch (error) {
    console.error("Error getting students:", error);
    return [];
  }
};

const addStudent = async (studentData) => {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(studentData),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to add student');
    }
    
    return await res.json();
  } catch (error) {
    throw error; 
  }
};

const addStudentsBulk = async (studentsArray) => {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(studentsArray),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to add students in bulk');
    }
    
    return await res.json();
  } catch (error) {
    throw error; 
  }
};

const checkStudentsExist = async (ids) => {
  try {
    const res = await fetch(`${API_URL}/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });
    
    if (!res.ok) {
      throw new Error('Failed to check existing students');
    }
    
    return await res.json();
  } catch (error) {
    console.error("Error checking students:", error);
    return [];
  }
};


const getTeachers = async () => {
  try {
    const res = await fetch(API_URL_TEACHERS);
    if (!res.ok) throw new Error('Failed to fetch teachers');
    const data = await res.json();
    return Array.isArray(data) ? data : []; 
  } catch (error) {
    console.error("Error getting teachers:", error);
    return [];
  }
};

const addTeachersBulk = async (teachersArray) => {
  try {
    const res = await fetch(API_URL_TEACHERS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teachersArray),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to add teachers in bulk');
    }
    
    return await res.json();
  } catch (error) {
    throw error; 
  }
};

const checkTeachersExist = async (emails) => {
  try {
    const res = await fetch(`${API_URL_TEACHERS}/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails }),
    });
    
    if (!res.ok) {
      throw new Error('Failed to check existing teachers');
    }
    
    return await res.json();
  } catch (error) {
    console.error("Error checking teachers:", error);
    return [];
  }
};

const addTeacher = async (teacherData) => {
  try {
    const res = await fetch(API_URL_TEACHERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacherData),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to add teacher');
    }
    return await res.json();
  } catch (error) {
    throw error; 
  }
};

const getClassrooms = async (yearId) => {
  try {
    let url = API_URL_CLASSROOMS;
    if (yearId && yearId !== "all") {
        url += `?yearId=${yearId}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch classrooms');
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

const addClassroom = async (data) => {
  try {
    const res = await fetch(API_URL_CLASSROOMS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add classroom');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const getAcademicYears = async () => {
    try {
      const res = await fetch(API_URL_YEARS);
      if (!res.ok) throw new Error('Failed to fetch years');
      return await res.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  const addAcademicYear = async (year, status) => {
  try {
    const res = await fetch(API_URL_YEARS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, status }),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to add year');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const deleteStudent = async (id, classroomId) => {
  try {
    let url = `${API_URL}?id=${id}`;
    if (classroomId) url += `&classroomId=${classroomId}`;
    const res = await fetch(url, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete student');
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const updateStudent = async (studentData) => {
  try {
    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update student');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const deleteTeacher = async (id) => {
  try {
    const res = await fetch(`${API_URL_TEACHERS}?id=${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete teacher');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const updateTeacher = async (teacherData) => {
  try {
    const res = await fetch(API_URL_TEACHERS, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacherData),
    });
    
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update teacher');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const deleteClassroom = async (id) => {
  try {
    const res = await fetch(`${API_URL_CLASSROOMS}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete classroom');
    }
    return await res.json();
  } catch (error) { throw error; }
};

const updateClassroom = async (data) => {
  try {
    const res = await fetch(API_URL_CLASSROOMS, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update classroom');
    }
    return await res.json();
  } catch (error) { throw error; }
};

const getStudentsPaginated = async (yearId, grade, roomType, page = 1, limit = 20, searchQuery = "") => {
  try {
    let url = API_URL + '?';
    const params = new URLSearchParams();
    if (yearId && yearId !== "all") params.append('yearId', yearId);
    if (grade && grade !== "all") params.append('grade', grade);
    if (roomType && roomType !== "all") params.append('roomType', roomType);
    if (searchQuery) params.append('search', searchQuery);
    params.append('page', page);
    params.append('limit', limit);

    const res = await fetch(url + params.toString());
    if (!res.ok) {
        throw new Error('Failed to fetch students');
    }
    return await res.json();
  } catch (error) {
    console.error("Error getting students paginated:", error);
    return { data: [], pagination: {} };
  }
};

const getTeachersPaginated = async (page = 1, limit = 20, searchQuery = "") => {
  try {
    let url = API_URL_TEACHERS + '?';
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    params.append('page', page);
    params.append('limit', limit);

    const res = await fetch(url + params.toString());
    if (!res.ok) throw new Error('Failed to fetch teachers');
    return await res.json();
  } catch (error) {
    console.error("Error getting teachers paginated:", error);
    return { data: [], pagination: {} };
  }
};

const getCampsPaginated = async (page = 1, limit = 20, search = "", status = "", deleted = false) => {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);
    if (deleted) params.append('deleted', 'true');
    params.append('page', page);
    params.append('limit', limit);

    const res = await fetch(`${API_URL_CAMPS_ADMIN}?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch camps');
    return await res.json();
  } catch (error) {
    console.error("Error getting camps paginated:", error);
    return { data: [], pagination: {} };
  }
};

const updateCamp = async (campId, data) => {
  try {
    const res = await fetch(`/api/camps/${campId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to update camp');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const restoreCamp = async (campId) => {
  try {
    const res = await fetch(API_URL_CAMPS_ADMIN, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ camp_id: campId }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to restore camp');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const permanentDeleteCamp = async (campId) => {
  try {
    const res = await fetch(`${API_URL_CAMPS_ADMIN}?camp_id=${campId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to permanently delete camp');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

const getClassroomsPaginated = async (yearId, page = 1, limit = 20) => {
  try {
    let url = API_URL_CLASSROOMS + '?';
    const params = new URLSearchParams();
    if (yearId && yearId !== "all") params.append('yearId', yearId);
    params.append('page', page);
    params.append('limit', limit);

    const res = await fetch(url + params.toString());
    if (!res.ok) throw new Error('Failed to fetch classrooms');
    return await res.json();
  } catch (error) {
    console.error("Error getting classrooms paginated:", error);
    return { data: [], pagination: {} };
  }
};

const getOverviewStats = async (yearId) => {
  try {
    let url = `/api/overview`;
    if (yearId && yearId !== "all") {
        url += `?yearId=${yearId}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch overview stats');
    return await res.json();
  } catch (error) {
    console.error("Error getting overview stats:", error);
    return null;
  }
};

export default {
  getOverviewStats,
  getCampsPaginated,
  updateCamp,
  restoreCamp,
  permanentDeleteCamp,
  getStudents,
  getStudentsPaginated,
  addStudent,
  addStudentsBulk,
  checkStudentsExist,
  deleteStudent,
  updateStudent,
  deleteTeacher,
  updateTeacher,
  getTeachers,
  getTeachersPaginated,
  addTeacher,
  addTeachersBulk,
  checkTeachersExist,
  getClassrooms,
  getClassroomsPaginated,
  addClassroom,
  getAcademicYears,
  addAcademicYear,
  deleteAcademicYear: async (id) => {
    try {
        const res = await fetch(`${API_URL_YEARS}?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to delete academic year');
        }
        return await res.json();
    } catch (e) { throw e; }
  },
  deleteClassroom,
  updateClassroom,
  getClassroomTypes : async () => {
    try {
        const res = await fetch(API_URL_CLASSROOM_TYPES);
        if (!res.ok) throw new Error('Failed to fetch classroom types');
        return await res.json();
    } catch (e) { console.error(e); return []; }
  },
  addClassroomType : async (data) => {
    try {
        const res = await fetch(API_URL_CLASSROOM_TYPES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to add classroom type');
        return await res.json();
    } catch (e) { throw e; }
  },
  deleteClassroomType : async (id) => {
    try {
        const res = await fetch(`${API_URL_CLASSROOM_TYPES}?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete classroom type');
        return await res.json();
    } catch (e) { throw e; }
  },
  updateClassroomType : async (data) => {
    try {
        const res = await fetch(API_URL_CLASSROOM_TYPES, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update classroom type');
        return await res.json();
    } catch (e) { throw e; }
  },

  getDeletedStudents: async (page = 1, limit = 20, search = "") => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.append('search', search);
      const res = await fetch(`${API_URL_STUDENTS_ADMIN}?${params}`);
      if (!res.ok) throw new Error('Failed');
      return await res.json();
    } catch (e) { return { data: [], pagination: {} }; }
  },
  restoreStudent: async (id) => {
    const res = await fetch(API_URL_STUDENTS_ADMIN, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students_id: id }) });
    if (!res.ok) { const d = await res.json(); throw new Error(d.details || d.error); } return await res.json();
  },
  permanentDeleteStudent: async (id) => {
    const res = await fetch(`${API_URL_STUDENTS_ADMIN}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.details || d.error); } return await res.json();
  },

  getDeletedTeachers: async (page = 1, limit = 20, search = "") => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.append('search', search);
      const res = await fetch(`${API_URL_TEACHERS_ADMIN}?${params}`);
      if (!res.ok) throw new Error('Failed');
      return await res.json();
    } catch (e) { return { data: [], pagination: {} }; }
  },
  restoreTeacher: async (id) => {
    const res = await fetch(API_URL_TEACHERS_ADMIN, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teachers_id: id }) });
    if (!res.ok) { const d = await res.json(); throw new Error(d.details || d.error); } return await res.json();
  },
  permanentDeleteTeacher: async (id) => {
    const res = await fetch(`${API_URL_TEACHERS_ADMIN}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.details || d.error); } return await res.json();
  },

  // ====== Trash: Classrooms ======
  getDeletedClassrooms: async (page = 1, limit = 20) => {
    try {
      const params = new URLSearchParams({ page, limit });
      const res = await fetch(`${API_URL_CLASSROOMS_ADMIN}?${params}`);
      if (!res.ok) throw new Error('Failed');
      return await res.json();
    } catch (e) { return { data: [], pagination: {} }; }
  },
  restoreClassroom: async (id) => {
    const res = await fetch(API_URL_CLASSROOMS_ADMIN, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classroom_id: id }) });
    if (!res.ok) { const d = await res.json(); throw new Error(d.details || d.error); } return await res.json();
  },
  permanentDeleteClassroom: async (id) => {
    const res = await fetch(`${API_URL_CLASSROOMS_ADMIN}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.details || d.error); } return await res.json();
  },
};
