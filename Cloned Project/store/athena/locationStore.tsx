import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Country, State, City, ICountry, IState, ICity } from "country-state-city";

// Types
export interface LocationState {
  // Data
  countries: ICountry[];
  states: IState[];
  cities: ICity[];
  
  // Selected values
  selectedCountry: ICountry | null;
  selectedState: IState | null;
  selectedCity: ICity | null;
  
  // Loading states
  isLoadingCountries: boolean;
  isLoadingStates: boolean;
  isLoadingCities: boolean;
  
  // Error states
  error: string | null;
  
  // Actions - Data Loading
  loadCountries: () => void;
  loadStates: (countryCode: string) => void;
  loadCities: (countryCode: string, stateCode: string) => void;
  
  // Actions - Selection
  setSelectedCountry: (country: ICountry | null) => void;
  setSelectedState: (state: IState | null) => void;
  setSelectedCity: (city: ICity | null) => void;
  
  // Actions - Reset
  resetStates: () => void;
  resetCities: () => void;
  resetAll: () => void;
  
  // Actions - Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Helper methods
  getCountryByCode: (code: string) => ICountry | undefined;
  getStateByCode: (countryCode: string, stateCode: string) => IState | undefined;
  getCityByName: (countryCode: string, stateCode: string, cityName: string) => ICity | undefined;
  getCountriesByName: (name: string) => ICountry[];
  getStatesByName: (countryCode: string, name: string) => IState[];
  getCitiesByName: (countryCode: string, stateCode: string, name: string) => ICity[];
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      // Initial state
      countries: [],
      states: [],
      cities: [],
      selectedCountry: null,
      selectedState: null,
      selectedCity: null,
      isLoadingCountries: false,
      isLoadingStates: false,
      isLoadingCities: false,
      error: null,

      // Data Loading Actions
      loadCountries: () => {
        set({ isLoadingCountries: true, error: null });
        
        try {
          const countries = Country.getAllCountries();
          set({ 
            countries, 
            isLoadingCountries: false 
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load countries';
          set({ 
            error: errorMessage, 
            isLoadingCountries: false 
          });
        }
      },

      loadStates: (countryCode: string) => {
        set({ isLoadingStates: true, error: null });
        
        try {
          const states = State.getStatesOfCountry(countryCode);
          set({ 
            states, 
            isLoadingStates: false,
            // Reset cities when states change
            cities: [],
            selectedState: null,
            selectedCity: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load states';
          set({ 
            error: errorMessage, 
            isLoadingStates: false 
          });
        }
      },

      loadCities: (countryCode: string, stateCode: string) => {
        set({ isLoadingCities: true, error: null });
        
        try {
          const cities = City.getCitiesOfState(countryCode, stateCode);
          set({ 
            cities, 
            isLoadingCities: false,
            selectedCity: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load cities';
          set({ 
            error: errorMessage, 
            isLoadingCities: false 
          });
        }
      },

      // Selection Actions
      setSelectedCountry: (country) => {
        set({ 
          selectedCountry: country,
          // Reset dependent selections
          selectedState: null,
          selectedCity: null,
          states: [],
          cities: [],
        });
        
        // Auto-load states if country is selected
        if (country) {
          get().loadStates(country.isoCode);
        }
      },

      setSelectedState: (state) => {
        set({ 
          selectedState: state,
          // Reset dependent selections
          selectedCity: null,
          cities: [],
        });
        
        // Auto-load cities if state is selected
        if (state && get().selectedCountry) {
          get().loadCities(get().selectedCountry!.isoCode, state.isoCode);
        }
      },

      setSelectedCity: (city) => {
        set({ selectedCity: city });
      },

      // Reset Actions
      resetStates: () => {
        set({
          states: [],
          selectedState: null,
          selectedCity: null,
          cities: [],
        });
      },

      resetCities: () => {
        set({
          cities: [],
          selectedCity: null,
        });
      },

      resetAll: () => {
        set({
          selectedCountry: null,
          selectedState: null,
          selectedCity: null,
          states: [],
          cities: [],
        });
      },

      // Error handling
      setError: (error) => set({ error }),
      
      clearError: () => set({ error: null }),

      // Helper methods
      getCountryByCode: (code: string) => {
        return get().countries.find(country => country.isoCode === code);
      },

      getStateByCode: (countryCode: string, stateCode: string) => {
        // Load states if not already loaded for this country
        const currentStates = get().states;
        if (currentStates.length === 0 || 
            (get().selectedCountry?.isoCode !== countryCode)) {
          get().loadStates(countryCode);
        }
        
        return get().states.find(state => state.isoCode === stateCode);
      },

      getCityByName: (countryCode: string, stateCode: string, cityName: string) => {
        // Load cities if not already loaded for this state
        const currentCities = get().cities;
        if (currentCities.length === 0 || 
            (get().selectedState?.isoCode !== stateCode)) {
          get().loadCities(countryCode, stateCode);
        }
        
        return get().cities.find(city => city.name === cityName);
      },

      getCountriesByName: (name: string) => {
        const searchTerm = name.toLowerCase();
        return get().countries.filter(country => 
          country.name.toLowerCase().includes(searchTerm)
        );
      },

      getStatesByName: (countryCode: string, name: string) => {
        // Ensure states are loaded for the country
        if (get().selectedCountry?.isoCode !== countryCode) {
          get().loadStates(countryCode);
        }
        
        const searchTerm = name.toLowerCase();
        return get().states.filter(state => 
          state.name.toLowerCase().includes(searchTerm)
        );
      },

      getCitiesByName: (countryCode: string, stateCode: string, name: string) => {
        // Ensure cities are loaded for the state
        if (get().selectedState?.isoCode !== stateCode) {
          get().loadCities(countryCode, stateCode);
        }
        
        const searchTerm = name.toLowerCase();
        return get().cities.filter(city => 
          city.name.toLowerCase().includes(searchTerm)
        );
      },
    }),
    {
      name: "location-storage",
      storage: createJSONStorage(() => localStorage),
      // Persist countries data to avoid reloading
      partialize: (state) => ({ 
        countries: state.countries,
      }),
    }
  )
);

// Selectors for better performance
export const useCountries = () => useLocationStore((state) => state.countries);
export const useStates = () => useLocationStore((state) => state.states);
export const useCities = () => useLocationStore((state) => state.cities);
export const useSelectedCountry = () => useLocationStore((state) => state.selectedCountry);
export const useSelectedState = () => useLocationStore((state) => state.selectedState);
export const useSelectedCity = () => useLocationStore((state) => state.selectedCity);
export const useLocationLoading = () => useLocationStore((state) => ({
  countries: state.isLoadingCountries,
  states: state.isLoadingStates,
  cities: state.isLoadingCities,
}));
