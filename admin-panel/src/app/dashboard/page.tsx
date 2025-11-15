'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/login')
    } else {
      setLoading(false)
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">QuantumTraffic Engine - Admin Panel</h1>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Backend Status</CardTitle>
              <CardDescription>Backend API Server</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">✅ Running</div>
              <p className="text-sm text-muted-foreground mt-2">Port: 5252</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Runners Online</CardTitle>
              <CardDescription>Connected runner instances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-sm text-muted-foreground mt-2">No runners connected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Jobs</CardTitle>
              <CardDescription>Currently running jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-sm text-muted-foreground mt-2">No active jobs</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>QuantumTraffic Engine Configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">Backend URL:</span>
                <span className="text-muted-foreground">https://trafficbuster.my.id:5252</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">Admin Panel URL:</span>
                <span className="text-muted-foreground">https://trafficbuster.my.id:5353</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">Runner Port:</span>
                <span className="text-muted-foreground">5522</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">Version:</span>
                <span className="text-muted-foreground">1.0.0</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium">Status:</span>
                <span className="text-green-600 font-semibold">✅ Operational</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Button variant="default">
                View Runners
              </Button>
              <Button variant="default">
                Manage Users
              </Button>
              <Button variant="default">
                View Logs
              </Button>
              <Button variant="default">
                System Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
