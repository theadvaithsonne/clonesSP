// "use client";

// import { useState, useContext, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import {
//     Dialog,
//     DialogContent,
//     DialogDescription,
//     DialogHeader,
//     DialogTitle,
//     DialogTrigger,
// } from "@/components/ui/dialog";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import {
//     Select,
//     SelectContent,
//     SelectItem,
//     SelectTrigger,
//     SelectValue,
// } from "@/components/ui/select";

// import { toast } from "sonner";

// import {

//     PenSquare,
// } from "lucide-react";
// interface AppSidebarProps {
//     isCollapsed: boolean;
// }
// // Define the industry to sector mapping
// const industrySectorMap: Record<string, string[]> = {
//     fintech: [
//         "Digital Banking",
//         "Payments & Transfers",
//         "Lending & Credit",
//         "Investment Tech",
//         "Blockchain & Crypto",
//         "Insurance Tech",
//         "RegTech",
//         "Wealth Management"
//     ],
//     healthcare: [
//         "Telemedicine",
//         "Health Diagnostics",
//         "Medical Devices",
//         "Pharmaceutical Tech",
//         "Mental Health",
//         "Fitness & Wellness",
//         "Healthcare Analytics",
//         "Personalized Medicine"
//     ],
//     ecommerce: [
//         "B2C Retail",
//         "B2B Marketplace",
//         "D2C Brands",
//         "Subscription Commerce",
//         "Social Commerce",
//         "Luxury Goods",
//         "Sustainable Products",
//         "Cross-border Commerce"
//     ],
//     saas: [
//         "Enterprise Software",
//         "CRM",
//         "Project Management",
//         "HR Tech",
//         "Marketing Automation",
//         "Collaboration Tools",
//         "Vertical SaaS",
//         "Developer Tools"
//     ],
//     education: [
//         "EdTech Platforms",
//         "Language Learning",
//         "Professional Upskilling",
//         "K-12 Education",
//         "Higher Education",
//         "Corporate Training",
//         "STEM Education",
//         "Special Needs Education"
//     ],
//     social: [
//         "Social Networking",
//         "Content Creation",
//         "Community Platforms",
//         "Dating Apps",
//         "Professional Networking",
//         "Audio Social",
//         "Video Sharing",
//         "Interest-based Communities"
//     ],
//     marketplace: [
//         "Services Marketplace",
//         "Freelance Platforms",
//         "Rental Economy",
//         "Peer-to-Peer",
//         "B2B Exchange",
//         "Local Services",
//         "Talent Marketplaces",
//         "Specialty Goods"
//     ],
//     gaming: [
//         "Mobile Gaming",
//         "PC/Console Gaming",
//         "Esports",
//         "Game Development Tools",
//         "Gaming Communities",
//         "VR/AR Gaming",
//         "Blockchain Gaming",
//         "Educational Games"
//     ],
//     other: [
//         "Other Sector 1",
//         "Other Sector 2",
//         "Other Sector 3"
//     ]
// };
// interface DesktopSidebarProps {
//     isCollapsed: boolean;
// }
// interface FormData {
//     email: string;
//     type: string;
//     date: string;
//     idea: string;
//     sector: string;
//     industry: string;
//     companyName: string;
// }
// export function AppSidebar({ isCollapsed }: AppSidebarProps) {
//     return (
//         <div className="hidden w-full flex-shrink-0 border-r bg-background md:block">
//             <DesktopSidebar isCollapsed={isCollapsed} />
//         </div>
//     );
// }

// function DesktopSidebar({ isCollapsed }: DesktopSidebarProps) {
//     const [availableSectors, setAvailableSectors] = useState<string[]>([]);
//     const [isSubmitting, setIsSubmitting] = useState(false);
//     const [formData, setFormData] = useState<FormData>({
//         email: "",
//         type: "",
//         date: new Date().toISOString().split('T')[0],
//         idea: '',
//         sector: '',
//         industry: '',
//         companyName: ''
//     });




//     const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//         const { name, value } = e.target;
//         setFormData(prev => ({
//             ...prev,
//             [name]: value
//         }));
//     };
//     console.log("formData", formData)

//     const handleIndustryChange = (value: string) => {
//         setFormData(prev => ({
//             ...prev,
//             industry: value,
//             sector: '' // Reset sector when industry changes
//         }));

//         // Update available sectors based on selected industry
//         setAvailableSectors(industrySectorMap[value] || []);
//     };

//     const handleSelectChange = (name: string, value: string) => {
//         setFormData(prev => ({
//             ...prev,
//             [name]: value
//         }));
//     };

//     const handleRadioChange = (value: string) => {
//         setFormData(prev => ({
//             ...prev,
//             type: value
//         }));
//     };
//     console.log("formDataeeeeeeeeee", formData)
//     const handleSubmit = async (e: React.FormEvent) => {
//         e.preventDefault();
     
//         const requiredFields: (keyof FormData)[] = [
//             'email',
//             'type',
//             'idea',
//             'sector',
//             'industry',
//             'companyName',
//         ];
//         const isFormValid = requiredFields.every((field) => formData[field]?.trim() !== '');
//         if (!isFormValid) {
//             toast('Please fill out all required fields.');
//             return;
//         }
//         setIsSubmitting(true);

//         try {
//             const response = await fetch('https://startupbrokers.marketsverse.com/api/addprogramtype', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify(formData),
//             });

//             const result = await response.json();

//             if (!response.ok) {
//                 throw new Error(result.error || 'Failed to submit application');
//             }
//             if (result?.success) {
//                 toast("Your application has been submitted successfully.");
          
//                 setIsSubmitting(false);
//                 setFormData({
//                     email: "",
//                     type: "",
//                     date: new Date().toISOString().split('T')[0],
//                     idea: '',
//                     sector: '',
//                     industry: '',
//                     companyName: ''
//                 });
//             }
//             else {

//             }


//         } catch (error) {
//             toast(error instanceof Error ? error.message : "An unknown error occurred");
//         } finally {
//             setIsSubmitting(false);
//         }
//     };
// // 
//     return (
//         <Dialog open={MvpProgrogramOpen} onOpenChange={setMvpProgrogramOpen}>
//             <DialogTrigger asChild>
//                 {
//                     !isCollapsed ?
//                         <Button
//                             variant="outline"
//                             size="sm"
//                             className="w-full"
//                             onClick={handleOpen}
//                         >
//                             New Programs
//                         </Button>
//                         :
//                         <Button
//                             variant="outline"
//                             size="sm"
//                             className="w-full"
//                             onClick={handleOpen}
//                         >
//                             <PenSquare className="mr-2 h-4 w-4" />
//                         </Button>
//                 }

//             </DialogTrigger>
//             <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
//                 <DialogHeader>
//                     <DialogTitle>Start Your New Program</DialogTitle>
//                     <DialogDescription>
//                         Tell us about your idea and choose the program that&apos;s right for you.
//                     </DialogDescription>
//                 </DialogHeader>
//                 <form onSubmit={handleSubmit} className="space-y-6">
//                     {/* Program Selection */}
//                     <div className="space-y-3">
//                         <Label className="text-base font-semibold">Which program do you want to buy?</Label>
//                         <RadioGroup
//                             defaultValue="silver"
//                             className="grid grid-cols-2 gap-4"
//                             onValueChange={handleRadioChange}
//                         >
//                             <div>
//                                 <RadioGroupItem value="Gold" id="gold" className="peer sr-only" />
//                                 <Label
//                                     htmlFor="gold"
//                                     className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
//                                 >
//                                     <div className="text-center">
//                                         <div className="text-lg font-semibold text-yellow-600">Gold Program</div>
//                                         {/* <div className="text-sm text-muted-foreground mt-1">Complete MVP Development</div> */}
//                                         {/* <div className="text-xl font-bold mt-2">₹2,00,000</div> */}
//                                     </div>
//                                 </Label>
//                             </div>
//                             <div>
//                                 <RadioGroupItem value="Silver" id="silver" className="peer sr-only" />
//                                 <Label
//                                     htmlFor="silver"
//                                     className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
//                                 >
//                                     <div className="text-center">
//                                         <div className="text-lg font-semibold text-gray-600">Silver Program</div>
//                                         {/* <div className="text-sm text-muted-foreground mt-1">Strategy & Planning</div> */}
//                                         {/* <div className="text-xl font-bold mt-2">₹1,00,000</div> */}
//                                     </div>
//                                 </Label>
//                             </div>
//                         </RadioGroup>
//                     </div>

//                     {/* Idea Details */}
//                     <div className="space-y-2">
//                         <Label htmlFor="companyName">What&apos;s the name of your idea/startup?</Label>
//                         <Input
//                             id="companyName"
//                             name="companyName"
//                             placeholder="Enter your startup name"
//                             value={formData.companyName}
//                             onChange={handleChange}
//                             required
//                         />
//                     </div>

//                     <div className="space-y-2">
//                         <Label htmlFor="idea">Describe your idea</Label>
//                         <Textarea
//                             id="idea"
//                             name="idea"
//                             placeholder="Describe your business idea in detail..."
//                             value={formData.idea}
//                             onChange={handleChange}
//                             required
//                         />
//                     </div>

//                     <div className="space-y-2">
//                         <Label htmlFor="industry">What industry is your startup in?</Label>
//                         <Select
//                             onValueChange={handleIndustryChange}
//                             value={formData.industry}
//                             required
//                         >
//                             <SelectTrigger>
//                                 <SelectValue placeholder="Select your industry" />
//                             </SelectTrigger>
//                             <SelectContent>
//                                 <SelectItem value="fintech">FinTech</SelectItem>
//                                 <SelectItem value="healthcare">Healthcare</SelectItem>
//                                 <SelectItem value="ecommerce">E-commerce</SelectItem>
//                                 <SelectItem value="saas">SaaS</SelectItem>
//                                 <SelectItem value="education">Education</SelectItem>
//                                 <SelectItem value="social">Social Media</SelectItem>
//                                 <SelectItem value="marketplace">Marketplace</SelectItem>
//                                 <SelectItem value="gaming">Gaming</SelectItem>
//                                 <SelectItem value="other">Other</SelectItem>
//                             </SelectContent>
//                         </Select>
//                     </div>

//                     <div className="space-y-2">
//                         <Label htmlFor="sector">What sector is your startup in?</Label>
//                         <Select
//                             onValueChange={(value) => handleSelectChange('sector', value)}
//                             value={formData.sector}
//                             disabled={!formData.industry}
//                             required
//                         >
//                             <SelectTrigger>
//                                 <SelectValue placeholder={formData.industry ? "Select your sector" : "First select an industry"} />
//                             </SelectTrigger>
//                             <SelectContent>
//                                 {availableSectors.map(sector => (
//                                     <SelectItem key={sector} value={sector.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-')}>
//                                         {sector}
//                                     </SelectItem>
//                                 ))}
//                             </SelectContent>
//                         </Select>
//                     </div>

//                     <div className="flex gap-3 pt-4">
//                         <Button type="submit" className="flex-1" disabled={isSubmitting}>
//                             {isSubmitting ? "Submitting..." : "Submit Application"}
//                         </Button>
//                         <Button type="button" variant="outline" onClick={handleClose}>
//                             Close
//                         </Button>
//                     </div>
//                 </form>
//             </DialogContent>
//         </Dialog>
//     );
// }