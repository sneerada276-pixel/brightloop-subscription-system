"""
BrightLoop Subscription Management System - Backend Application
Flask REST API with SQLite database and CORS enabled.
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from models import db, Customer, Plan, Subscription, Invoice, Product, Tax, Discount

def create_app():
    app = Flask(__name__)

    # SQLite Database Configuration
    # Uses instance directory or local directory for database file
    base_dir = os.path.abspath(os.path.dirname(__file__))
    db_path = os.path.join(base_dir, 'subscriptions.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Enable Cross-Origin Resource Sharing (CORS)
    # Allows requests from Vite development server (http://localhost:5173)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize SQLAlchemy with the app
    db.init_app(app)

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'BrightLoop Subscription API',
            'version': '1.0.0',
            'database': 'SQLite connected',
            'endpoints': [
                '/api/health',
                '/api/dashboard/stats',
                '/api/plans',
                '/api/customers',
                '/api/subscriptions',
                '/api/invoices'
            ]
        }), 200

    # Ensure tables are created when the app context starts
    with app.app_context():
        db.create_all()

    return app

app = create_app()

if __name__ == '__main__':
    # Run the development server on port 5000
    print("Starting BrightLoop API server on http://localhost:5000 ...")
    app.run(host='0.0.0.0', port=5000, debug=True)
