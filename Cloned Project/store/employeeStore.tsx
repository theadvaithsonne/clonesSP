import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { toast } from "sonner";

// Types
export interface Employee {
  id: string;
  _id?: string; // MongoDB _id field
  name: string;
  email: string;
  position: string;
  department: string;
  status: string;
  dateOfBirth?: string;
  joinDate: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  profileImage?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface EmployeeFormData {
  id?: string;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  position: string;
  departmentId: string;
  department?: string;
  hireDate: string;
  status?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  profileImage?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export interface EmployeeApiResponse {
  id: string;
  _id?: string; // MongoDB _id field
  firstName: string;
  lastName: string;
  email?: string;
  position?: string;
  departmentId?: string;
  hireDate?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  status?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  profileImage?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  location?: string;
  manager?: string;
  employeeCount: number;
  leadCount?: number;
  createdAt: string;
}

export interface DepartmentApiResponse {
  id: string;
  name: string;
  description?: string;
  location?: string;
  manager?: string;
  employeeCount?: number;
  leadCount?: number;
  createdAt?: string;
}

export interface EmployeeFilters {
  departments: string[];
  statuses: string[];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export interface EmployeeState {
  // Data
  employees: Employee[];
  departments: Department[];
  selectedEmployees: string[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filters: EmployeeFilters;
  currentPage: number;
  itemsPerPage: number;
  
  // Actions - Data Management
  setEmployees: (employees: Employee[]) => void;
  setDepartments: (departments: Department[]) => void;
  addEmployee: (employeeData: EmployeeFormData) => Promise<Employee>;
  updateEmployee: (id: string, employeeData: Partial<EmployeeFormData>) => Promise<Employee>;
  deleteEmployee: (id: string) => Promise<void>;
  addDepartment: (department: Department) => void;
  updateDepartment: (id: string, department: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  
  // Actions - Selection
  setSelectedEmployees: (ids: string[]) => void;
  selectEmployee: (id: string) => void;
  deselectEmployee: (id: string) => void;
  selectAllEmployees: (employees: Employee[]) => void;
  clearSelection: () => void;
  
  // Actions - UI State
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: EmployeeFilters) => void;
  setCurrentPage: (page: number) => void;
  clearError: () => void;
  
  // Actions - API Calls
  fetchEmployees: () => Promise<void>;
  fetchDepartments: () => Promise<void>;
  fetchEmployeeById: (id: string) => Promise<Employee | null>;
  bulkUploadEmployees: (employees: any[]) => Promise<any>;
  
  // Computed/Helper methods
  getFilteredEmployees: () => Employee[];
  getDepartmentName: (departmentId: string) => string;
  getEmployeesByDepartment: (departmentId: string) => Employee[];
  getTotalPages: () => number;
  getCurrentPageEmployees: () => Employee[];
}

export const useEmployeeStore = create<EmployeeState>()(
  persist(
    (set, get) => ({
      // Initial state
      employees: [],
      departments: [],
      selectedEmployees: [],
      isLoading: false,
      error: null,
      searchQuery: "",
      filters: {
        departments: [],
        statuses: [],
        dateRange: { from: undefined, to: undefined }
      },
      currentPage: 1,
      itemsPerPage: 10,

      // Data Management Actions
      setEmployees: (employees) => set({ employees }),
      
      setDepartments: (departments) => set({ departments }),
      
      addEmployee: async (employeeData: EmployeeFormData) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authenticatedFetch(buildExternalUrl("employees"), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(employeeData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create employee');
          }

          const result = await response.json();
          
          // Add the new employee to local state
          const newEmployee: Employee = {
            id: result.id || result._id || new Date().getTime().toString(),
            _id: result._id || result.id, // Use _id if available, fallback to id
            name: employeeData.name || `${employeeData.firstName} ${employeeData.lastName}`,
            email: employeeData.email,
            position: employeeData.position,
            department: employeeData.department || employeeData.departmentId,
            status: employeeData.status || "Active",
            dateOfBirth: employeeData.dateOfBirth,
            joinDate: employeeData.hireDate,
            firstName: employeeData.firstName,
            lastName: employeeData.lastName,
            phone: employeeData.phone,
            address: employeeData.address,
            emergencyContact: employeeData.emergencyContact,
            profileImage: employeeData.profileImage,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            employees: [newEmployee, ...state.employees], // Add to beginning for recent-first order
            isLoading: false
          }));

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create employee';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },
      
      updateEmployee: async (id: string, employeeData: Partial<EmployeeFormData>) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authenticatedFetch(buildExternalUrl(`employees/${id}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(employeeData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update employee');
          }

          const result = await response.json();
          
          // Show toast if password reset email was sent
          if (result.emailSent) {
            toast.success("Employee activated and password reset email sent!");
          }
          
          // Update the employee in local state and move to beginning
          set((state) => {
            const updatedEmployee = state.employees.find(emp => emp.id === id || emp._id === id);
            if (!updatedEmployee) return { isLoading: false };
            
            const updatedEmp: Employee = { 
              ...updatedEmployee, 
              name: employeeData.name || (employeeData.firstName && employeeData.lastName ? `${employeeData.firstName} ${employeeData.lastName}` : updatedEmployee.name),
              email: employeeData.email || updatedEmployee.email,
              position: employeeData.position || updatedEmployee.position,
              department: employeeData.department || employeeData.departmentId || updatedEmployee.department,
              status: employeeData.status || updatedEmployee.status,
              dateOfBirth: employeeData.dateOfBirth || updatedEmployee.dateOfBirth,
              joinDate: employeeData.hireDate || updatedEmployee.joinDate,
              firstName: employeeData.firstName || updatedEmployee.firstName,
              lastName: employeeData.lastName || updatedEmployee.lastName,
              phone: employeeData.phone || updatedEmployee.phone,
              address: employeeData.address || updatedEmployee.address,
              emergencyContact: employeeData.emergencyContact || updatedEmployee.emergencyContact,
              profileImage: employeeData.profileImage || updatedEmployee.profileImage,
              updatedAt: new Date().toISOString(),
            };
            
            // Remove the old employee and add updated one at the beginning
            const otherEmployees = state.employees.filter(emp => emp.id !== id && emp._id !== id);
            
            return {
              employees: [updatedEmp, ...otherEmployees],
              isLoading: false
            };
          });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update employee';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },
      
      deleteEmployee: async (id: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authenticatedFetch(buildExternalUrl(`employees/${id}`), {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete employee');
          }

          // Remove the employee from local state using both id and _id
          set((state) => ({
            employees: state.employees.filter(emp => emp.id !== id && emp._id !== id),
            selectedEmployees: state.selectedEmployees.filter(empId => empId !== id),
            isLoading: false
          }));

          toast.success("Employee deleted successfully!");
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete employee';
          set({ error: errorMessage, isLoading: false });
          toast.error(errorMessage);
          throw error;
        }
      },
      
      addDepartment: (department) => set((state) => ({
        departments: [...state.departments, department]
      })),
      
      updateDepartment: (id, departmentData) => set((state) => ({
        departments: state.departments.map(dept => 
          dept.id === id ? { ...dept, ...departmentData } : dept
        )
      })),
      
      deleteDepartment: (id) => set((state) => ({
        departments: state.departments.filter(dept => dept.id !== id)
      })),

      // Selection Actions
      setSelectedEmployees: (ids) => set({ selectedEmployees: ids }),
      
      selectEmployee: (id) => set((state) => ({
        selectedEmployees: state.selectedEmployees.includes(id) 
          ? state.selectedEmployees 
          : [...state.selectedEmployees, id]
      })),
      
      deselectEmployee: (id) => set((state) => ({
        selectedEmployees: state.selectedEmployees.filter(empId => empId !== id)
      })),
      
      selectAllEmployees: (employees) => set({
        selectedEmployees: employees.map(emp => emp.id)
      }),
      
      clearSelection: () => set({ selectedEmployees: [] }),

      // UI State Actions
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      clearError: () => set({ error: null }),
      
      setSearchQuery: (query) => set({ 
        searchQuery: query, 
        currentPage: 1,
        selectedEmployees: [] // Clear selection when search changes
      }),
      
      setFilters: (filters) => set({ 
        filters, 
        currentPage: 1,
        selectedEmployees: [] // Clear selection when filters change
      }),
      
      setCurrentPage: (page) => set({ 
        currentPage: page,
        selectedEmployees: [] // Clear selection when page changes
      }),

      // API Actions
      fetchEmployees: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authenticatedFetch(buildExternalUrl("employees"));
          if (!response.ok) {
            throw new Error('Failed to fetch employees');
          }
          
          const empData = await response.json();
          const mappedEmployees = empData.map((emp: EmployeeApiResponse) => ({
            id: emp.id,
            _id: emp._id || emp.id, // Use _id if available, fallback to id
            name: `${emp.firstName} ${emp.lastName}`,
            email: emp.email || "",
            position: emp.position || "",
            department: emp.departmentId || "",
            status: emp.status || "Active",
            dateOfBirth: emp.dateOfBirth,
            joinDate: emp.hireDate
              ? (typeof emp.hireDate === 'string'
                ? emp.hireDate.split('T')[0]
                : new Date(emp.hireDate).toISOString().split('T')[0])
              : new Date().toISOString().split('T')[0],
            firstName: emp.firstName,
            lastName: emp.lastName,
            phone: emp.phone,
            address: emp.address,
            emergencyContact: emp.emergencyContact,
            profileImage: emp.profileImage,
            updatedAt: emp.updatedAt,
            createdAt: emp.createdAt,
          }));
          
          set({ employees: mappedEmployees, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employees';
          set({ error: errorMessage, isLoading: false });
        }
      },

      fetchDepartments: async () => {
        try {
          const response = await authenticatedFetch(buildExternalUrl("departments"));
          if (!response.ok) {
            throw new Error('Failed to fetch departments');
          }
          
          const deptData = await response.json();
          const mappedDepartments = deptData.map((dept: DepartmentApiResponse) => ({
            id: dept.id,
            name: dept.name,
            description: dept.description || "",
            location: dept.location || "",
            manager: dept.manager || "",
            employeeCount: dept.employeeCount || 0,
            leadCount: dept.leadCount || 0,
            createdAt: dept.createdAt
              ? (typeof dept.createdAt === 'string'
                ? dept.createdAt.split('T')[0]
                : new Date(dept.createdAt).toISOString().split('T')[0])
              : new Date().toISOString().split('T')[0]
          }));
          
          set({ departments: mappedDepartments });
        } catch (error) {
          console.error('Error fetching departments:', error);
        }
      },

      fetchEmployeeById: async (id: string) => {
        try {
          const response = await authenticatedFetch(buildExternalUrl(`employees/${id}`));
          if (!response.ok) {
            throw new Error('Failed to fetch employee');
          }

          const empData = await response.json();
          // Return the employee data from the nested structure
          return empData.employee || empData;
        } catch (error) {
          console.error('Error fetching employee:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee';
          set({ error: errorMessage });
          return null;
        }
      },

      bulkUploadEmployees: async (employees: any[]) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authenticatedFetch(buildExternalUrl("employees/bulk-upload"), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ employees }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to bulk upload employees');
          }

          const result = await response.json();

          // Refresh employees list after successful upload
          if (result.results && result.results.successful > 0) {
            await get().fetchEmployees();
          }

          set({ isLoading: false });
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to bulk upload employees';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      // Computed/Helper methods
      getFilteredEmployees: () => {
        const { employees, searchQuery, filters, departments } = get();
        
        return employees.filter((employee) => {
          // Search filter
          const matchesSearch = !searchQuery || 
            employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            employee.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
            get().getDepartmentName(employee.department).toLowerCase().includes(searchQuery.toLowerCase());

          if (!matchesSearch) return false;

          // Department filter
          if (filters.departments.length > 0 && !filters.departments.includes(employee.department)) {
            return false;
          }

          // Status filter
          if (filters.statuses.length > 0 && !filters.statuses.includes(employee.status)) {
            return false;
          }

          // Date range filter
          if (filters.dateRange.from || filters.dateRange.to) {
            const joinDate = new Date(employee.joinDate);
            const fromDate = filters.dateRange.from;
            const toDate = filters.dateRange.to;

            if (fromDate && joinDate < fromDate) return false;
            if (toDate && joinDate > toDate) return false;
          }

          return true;
        });
      },

      getDepartmentName: (departmentId: string) => {
        const department = get().departments.find(dept => dept.id === departmentId);
        return department ? department.name : 'Unknown Department';
      },

      getEmployeesByDepartment: (departmentId: string) => {
        return get().employees.filter(emp => emp.department === departmentId);
      },

      getTotalPages: () => {
        const filteredEmployees = get().getFilteredEmployees();
        return Math.ceil(filteredEmployees.length / get().itemsPerPage);
      },

      getCurrentPageEmployees: () => {
        const { currentPage, itemsPerPage } = get();
        const filteredEmployees = get().getFilteredEmployees();
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredEmployees.slice(startIndex, endIndex);
      },
    }),
    {
      name: "employee-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist data, not UI state
      partialize: (state) => ({ 
        employees: state.employees,
        departments: state.departments,
      }),
    }
  )
);

// Selectors for better performance
export const useEmployees = () => useEmployeeStore((state) => state.employees);
export const useDepartments = () => useEmployeeStore((state) => state.departments);
export const useSelectedEmployees = () => useEmployeeStore((state) => state.selectedEmployees);
export const useEmployeeLoading = () => useEmployeeStore((state) => state.isLoading);
export const useEmployeeError = () => useEmployeeStore((state) => state.error);
