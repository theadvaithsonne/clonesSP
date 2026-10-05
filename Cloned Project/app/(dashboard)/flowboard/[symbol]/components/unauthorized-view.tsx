import { ShieldAlert, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function UnauthorizedView() {
    const router = useRouter();

    return (
        <div className="h-screen w-full bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 border border-gray-100">
                <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        You do not have permission to view this Kanban board.
                        Please contact the board administrator to request access.
                    </p>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                    <button
                        onClick={() => router.push('/flowboard')}
                        className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                    >
                        Go to Dashboard
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl border border-gray-200 transition-all duration-200"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    );
}
