import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// Default admin credentials
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'quantum2025', // Change this in production!
}

// JWT secret from environment or default
const JWT_SECRET = process.env.JWT_SECRET || 'quantum-ultra-secure-jwt-secret-production-2025'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // Validate credentials
    if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
      // Generate JWT token
      const token = jwt.sign(
        { 
          username: username,
          role: 'admin',
          iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      )

      return NextResponse.json({
        success: true,
        token: token,
        message: 'Login successful'
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid username or password'
        },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Server error'
      },
      { status: 500 }
    )
  }
}
