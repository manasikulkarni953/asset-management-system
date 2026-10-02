const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { ...options.headers };
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          const setCookie = res.headers['set-cookie'];
          let cookie = null;
          if (setCookie) {
            cookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            cookie,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function login(email, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (res.status !== 200 || !res.cookie) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.cookie;
}

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runSuite() {
  console.log('====================================================');
  console.log('   RBAC AUTHENTICATION & PERMISSIONS TEST SUITE');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // 1. Authenticate All 3 Roles
    // ----------------------------------------------------
    console.log('1. Authenticating Roles:');
    const superAdminCookie = await login('admin@enterprise.com', 'Admin@123');
    assert(superAdminCookie, 'Super Admin logged in successfully (super_admin)');

    const adminCookie = await login('itadmin@enterprise.com', 'Admin@123');
    assert(adminCookie, 'Admin logged in successfully (admin / IT Specialist)');

    const employeeCookie = await login('alex.j@enterprise.com', 'Employee@123');
    assert(employeeCookie, 'Employee logged in successfully (employee)');

    // ----------------------------------------------------
    // 2. Identity Verification (/api/auth/me)
    // ----------------------------------------------------
    console.log('\n2. Verifying Identities & Roles via /api/auth/me:');
    const saMe = await request('/api/auth/me', { cookie: superAdminCookie });
    assert(saMe.body.user.role === 'super_admin', 'Super Admin role verified as super_admin');

    const adminMe = await request('/api/auth/me', { cookie: adminCookie });
    assert(adminMe.body.user.role === 'admin', 'Admin role verified as admin');
    assert(adminMe.body.user.designation === 'IT Specialist', 'Admin designation verified as IT Specialist');

    const empMe = await request('/api/auth/me', { cookie: employeeCookie });
    assert(empMe.body.user.role === 'employee', 'Employee role verified as employee');
    assert(empMe.body.user.employee_id === 'EMP-1001', 'Employee employee_id verified as EMP-1001');

    // ----------------------------------------------------
    // 3. User Management Access Controls
    // ----------------------------------------------------
    console.log('\n3. User Management Endpoint Protection (/api/admin/users):');
    const saUsers = await request('/api/admin/users', { cookie: superAdminCookie });
    assert(saUsers.status === 200 && Array.isArray(saUsers.body.users), 'Super Admin can access /api/admin/users');

    const adminUsers = await request('/api/admin/users', { cookie: adminCookie });
    assert(adminUsers.status === 403, 'Admin is blocked from /api/admin/users (403 Forbidden)');

    const empUsers = await request('/api/admin/users', { cookie: employeeCookie });
    assert(empUsers.status === 403, 'Employee is blocked from /api/admin/users (403 Forbidden)');

    // ----------------------------------------------------
    // 4. IT Specialist Workload & Performance Analytics
    // ----------------------------------------------------
    console.log('\n4. IT Specialist Performance Endpoint Protection (/api/admin/it-specialists):');
    const saSpecialists = await request('/api/admin/it-specialists', { cookie: superAdminCookie });
    assert(saSpecialists.status === 200 && Array.isArray(saSpecialists.body.specialists), 'Super Admin can access /api/admin/it-specialists');
    assert(
      saSpecialists.body.specialists.some((s) => s.name === 'Rahul Sharma' && s.designation === 'IT Specialist'),
      'Factual MySQL data includes Rahul Sharma as IT Specialist'
    );

    const adminSpecialists = await request('/api/admin/it-specialists', { cookie: adminCookie });
    assert(adminSpecialists.status === 403, 'Admin is blocked from /api/admin/it-specialists (403 Forbidden)');

    const empSpecialists = await request('/api/admin/it-specialists', { cookie: employeeCookie });
    assert(empSpecialists.status === 403, 'Employee is blocked from /api/admin/it-specialists (403 Forbidden)');

    // ----------------------------------------------------
    // 5. Employee Self-Service Data Isolation (Employees)
    // ----------------------------------------------------
    console.log('\n5. Employee Data Isolation on Employees API:');
    const empOwnProfile = await request('/api/employees/1', { cookie: employeeCookie });
    assert(empOwnProfile.status === 200 && empOwnProfile.body.employee?.employee_id === 'EMP-1001', 'Employee can view own profile (EMP-1001)');

    const empOtherProfile = await request('/api/employees/2', { cookie: employeeCookie });
    assert(empOtherProfile.status === 403, 'Employee CANNOT view another employee profile (EMP-1002 returns 403 Forbidden)');

    const empAllEmployees = await request('/api/employees', { cookie: employeeCookie });
    assert(
      empAllEmployees.status === 200 && empAllEmployees.body.employees.length === 1 && empAllEmployees.body.employees[0].employee_id === 'EMP-1001',
      'Employee requesting /api/employees receives ONLY their own record'
    );

    const adminAllEmployees = await request('/api/employees', { cookie: adminCookie });
    assert(adminAllEmployees.status === 200 && adminAllEmployees.body.employees.length > 1, 'Admin can view all company employees');

    // ----------------------------------------------------
    // 6. Employee Equipment Custody Isolation (Assets)
    // ----------------------------------------------------
    console.log('\n6. Equipment Access Isolation (/api/assets):');
    const empAssets = await request('/api/assets', { cookie: employeeCookie });
    assert(empAssets.status === 200, 'Employee can query /api/assets');
    const allAssignedToAlex = empAssets.body.assets.every((a) => a.current_employee_id === 1);
    assert(allAssignedToAlex, 'Employee receives ONLY their currently assigned assets');

    const adminAssets = await request('/api/assets', { cookie: adminCookie });
    assert(adminAssets.status === 200 && adminAssets.body.assets.length >= 7, 'Admin can view all organization assets (all 7 assets)');

    // ----------------------------------------------------
    // 7. Restricted Modules (Assignments & Reports)
    // ----------------------------------------------------
    console.log('\n7. Operational Modules Protection (Assignments & Reports):');
    const empAssignments = await request('/api/assignments', { cookie: employeeCookie });
    assert(empAssignments.status === 403, 'Employee is blocked from /api/assignments (403 Forbidden)');

    const adminAssignments = await request('/api/assignments', { cookie: adminCookie });
    assert(adminAssignments.status === 200, 'Admin can manage /api/assignments');

    const empReports = await request('/api/reports', { cookie: employeeCookie });
    assert(empReports.status === 403, 'Employee is blocked from /api/reports (403 Forbidden)');

    const adminReports = await request('/api/reports', { cookie: adminCookie });
    assert(adminReports.status === 200, 'Admin can view operational /api/reports');

    // ----------------------------------------------------
    // 8. Ticket Creation, Isolation & Assignment to IT Specialist
    // ----------------------------------------------------
    console.log('\n8. Ticket Lifecycle & IT Specialist Workload Assignment:');
    // First, let's find an asset assigned to Alex
    const alexAsset = empAssets.body.assets[0];
    assert(alexAsset != null, `Found assigned asset for employee: ${alexAsset?.asset_number}`);

    // Employee raises a ticket
    const raiseRes = await request('/api/tickets', {
      method: 'POST',
      cookie: employeeCookie,
      body: {
        asset_id: alexAsset.id,
        employee_id: 1,
        raised_building: 'The Space',
        raised_floor: '5th Floor',
        raised_workstation: 'WS-5-042',
        issue_category: 'Hardware Failure',
        priority: 'high',
        issue_description: 'Automated RBAC Test: Cooling fan failure and thermal throttling',
      },
    });

    assert(raiseRes.status === 201 && raiseRes.body.ticket?.id, `Employee raised ticket ${raiseRes.body.ticket?.ticket_id}`);
    const createdTicket = raiseRes.body.ticket;
    const ticketId = createdTicket.id;

    assert(createdTicket.assigned_to === null, 'Ticket initially has assigned_to = null');

    // Employee tries to assign the ticket to someone -> Must FAIL (403)
    const empAssignAttempt = await request(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      cookie: employeeCookie,
      body: { assigned_to: 2, status: 'assigned' },
    });
    assert(empAssignAttempt.status === 403, 'Employee cannot assign ticket to technicians (403 Forbidden)');

    // Admin assigns the ticket to IT Specialist Rahul Sharma (id: 2)
    const adminAssign = await request(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        assigned_to: 2,
        status: 'assigned',
        comment: 'Assigned to IT Specialist Rahul Sharma for hardware inspection',
      },
    });
    assert(adminAssign.status === 200, 'Admin successfully assigned ticket to IT Specialist Rahul Sharma');

    // Verify ticket details show assigned_to
    const assignedDetail = await request(`/api/tickets/${ticketId}`, { cookie: adminCookie });
    assert(assignedDetail.body.ticket.assigned_to === 2, 'ticket.assigned_to is 2 (users.id)');
    assert(assignedDetail.body.ticket.assigned_to_name === 'Rahul Sharma', 'Assigned technician name is Rahul Sharma');

    // Super Admin checks IT Specialist workload -> verify factual increment in MySQL
    const workloadAfter = await request('/api/admin/it-specialists', { cookie: superAdminCookie });
    const rahulStats = workloadAfter.body.specialists.find((s) => s.id === 2);
    assert(rahulStats != null, 'Rahul Sharma found in IT Specialist workload table');
    assert(rahulStats.total_assigned >= 1, `Rahul Sharma total assigned tickets >= 1 (actual: ${rahulStats.total_assigned})`);

    // IT Specialist/Admin works on the ticket: changes to in_progress, then resolved
    const updateProgress = await request(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        status: 'in_progress',
        comment: 'Disassembled casing, inspected fan blades and heat pipe.',
      },
    });
    assert(updateProgress.status === 200, 'Admin updated status to in_progress');

    const updateResolved = await request(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        status: 'resolved',
        resolution: 'Replaced ball-bearing cooling fan and reapplied thermal compound.',
        comment: 'Benchmarked temperatures under load: max 68C.',
      },
    });
    assert(updateResolved.status === 200, 'Admin marked ticket as resolved with resolution details');

    // Super Admin checks drilldown for Rahul Sharma
    const rahulDrilldown = await request('/api/admin/it-specialists?specialistId=2', { cookie: superAdminCookie });
    assert(
      rahulDrilldown.status === 200 && Array.isArray(rahulDrilldown.body.tickets),
      'Super Admin can drill into IT Specialist tickets'
    );
    const hasResolvedTicket = rahulDrilldown.body.tickets.some((t) => t.id === ticketId);
    assert(hasResolvedTicket, 'Drilldown contains the newly resolved ticket with complete asset and employee context');

    // ----------------------------------------------------
    // Summary
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`RBAC Test Suite Completed: ${passedTests} / ${totalTests} assertions passed`);
    console.log('====================================================\n');

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error running RBAC test suite:', err);
    process.exit(1);
  }
}

runSuite();
